import mongoose from "mongoose";
import { ChatEventEnum } from "../../../constants.js";
import { User } from "../../../models/apps/auth/user.models.js";
import { Chat } from "../../../models/apps/chat-app/chat.models.js";
import { ChatMessage } from "../../../models/apps/chat-app/message.models.js";
import { emitSocketEvent } from "../../../socket/index.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { removeLocalFile } from "../../../utils/helpers.js";
import { UserKey } from "../../../models/apps/chat-app/userKey.model.js";

import {
  activeConnections,
  isUserConnected,
  isUserActive,
} from "../../../socket/socket.js";

// ─── Permission constants ─────────────────────────────────────────────────────
const ROLES = { ADMIN: "admin", MODERATOR: "moderator", MEMBER: "member" };

/**
 * Multi-admin permission matrix (WhatsApp-like + moderator layer):
 *
 *  admin      → can change ANY member's role, including other admins
 *               (only exception: cannot change their OWN role if last admin)
 *             → can remove moderators and members (NOT other admins)
 *             → can mute/unmute anyone (restrict them from sending messages)
 *             → can rename, add members, generate/revoke invite link, delete group
 *             → can leave at any time
 *
 *  moderator  → can add members, rename, generate invite link
 *             → can remove regular MEMBERS only
 *             → can mute/unmute regular members only
 *             → can leave at any time
 *
 *  member     → can send messages (if not muted), leave
 *
 * Last-person-leaves           → group auto-deletes.
 * Last admin leaves (others)   → oldest-joined member is auto-promoted to admin.
 */

// ─── Aggregation pipeline ─────────────────────────────────────────────────────
const chatCommonAggregation = () => [
  {
    $lookup: {
      from: "users",
      foreignField: "_id",
      localField: "participants",
      as: "participants",
      pipeline: [
        {
          $project: {
            password: 0,
            refreshToken: 0,
            forgotPasswordToken: 0,
            forgotPasswordExpiry: 0,
            emailVerificationToken: 0,
            emailVerificationExpiry: 0,
          },
        },
      ],
    },
  },
  {
    $lookup: {
      from: "users",
      localField: "members.user",
      foreignField: "_id",
      as: "_memberUsers",
      pipeline: [
        {
          $project: { username: 1, avatar: 1, email: 1, fullName: 1 },
        },
      ],
    },
  },
  {
    $addFields: {
      members: {
        $map: {
          input: "$members",
          as: "m",
          in: {
            user: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$_memberUsers",
                    as: "u",
                    cond: { $eq: ["$$u._id", "$$m.user"] },
                  },
                },
                0,
              ],
            },
            role:       "$$m.role",
            joinedAt:   "$$m.joinedAt",
            promotedBy: "$$m.promotedBy",
            // $ifNull ensures old documents (created before isMuted was added)
            // always return false instead of null/missing
            isMuted: { $ifNull: ["$$m.isMuted", false] },
          },
        },
      },
    },
  },
  { $unset: "_memberUsers" },
  {
    $lookup: {
      from: "chatmessages",
      foreignField: "_id",
      localField: "lastMessage",
      as: "lastMessage",
      pipeline: [
        {
          $lookup: {
            from: "users",
            foreignField: "_id",
            localField: "sender",
            as: "sender",
            pipeline: [{ $project: { username: 1, avatar: 1, email: 1 } }],
          },
        },
        { $addFields: { sender: { $first: "$sender" } } },
      ],
    },
  },
  { $addFields: { lastMessage: { $first: "$lastMessage" } } },
  // ── Capacity fields (group chats only) ─────────────────────────────────────
  // memberCount      : how many people are currently in the group
  // remainingCapacity: how many more can still join before hitting the 2048 cap
  // Both are 0 / 2048 for 1-on-1 chats (isGroupChat: false) so clients can
  // safely read these fields without needing an isGroupChat guard.
 
  {
      $addFields: {
        memberCount: {
          $cond: {
            if:   "$isGroupChat",
            then: { $size: "$members" },
            else: "$$REMOVE",
          },
        },
        remainingCapacity: {
          $cond: {
            if:   "$isGroupChat",
            then: { $subtract: [2048, { $size: "$members" }] },
            else: "$$REMOVE",
          },
        },
        editInfoLocked: { $ifNull: ["$editInfoLocked", false] },  // 👈 add this line
      },
    },
  ];  // <-- this closes the chatCommonAggregation array

// ─── Internal helpers ─────────────────────────────────────────────────────────

const deleteCascadeChatMessages = async (chatId) => {
  const messages = await ChatMessage.find({
    chat: new mongoose.Types.ObjectId(chatId),
  });
  const attachments = messages.flatMap((m) => m.attachments);
  attachments.forEach((a) => removeLocalFile(a.localPath));
  await ChatMessage.deleteMany({ chat: new mongoose.Types.ObjectId(chatId) });
};

/** Returns true if userId has the admin role in the members array. */
const isAdmin = (groupChat, userId) =>
  groupChat.members.some(
    (m) => m.user.toString() === userId.toString() && m.role === ROLES.ADMIN
  );

/** Returns the role string for a userId, or null if not a member. */
const getMemberRole = (groupChat, userId) => {
  const entry = groupChat.members.find(
    (m) => m.user.toString() === userId.toString()
  );
  return entry ? entry.role : null;
};

/**
 * Auto-promotes the earliest-joined non-admin member to admin.
 * Called when the last admin leaves but others remain.
 * Returns the promoted userId string, or null if no one to promote.
 */
const autoPromoteNextAdmin = async (groupChat) => {
  const nonAdmins = groupChat.members.filter((m) => m.role !== ROLES.ADMIN);
  if (nonAdmins.length === 0) return null;

  nonAdmins.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
  const next = nonAdmins[0];

  const idx = groupChat.members.findIndex(
    (m) => m.user.toString() === next.user.toString()
  );
  groupChat.members[idx].role       = ROLES.ADMIN;
  groupChat.members[idx].promotedBy = null;
  groupChat.admin = next.user; // keep legacy field consistent
  await groupChat.save();

  return next.user.toString();
};

// ─── E2EE helpers ─────────────────────────────────────────────────────────────

const storeGroupEncryptedKeys = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { encryptedGroupKeys } = req.body;

  if (!Array.isArray(encryptedGroupKeys) || encryptedGroupKeys.length === 0)
    throw new ApiError(400, "encryptedGroupKeys array is required");

  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!chat.isGroupChat) throw new ApiError(400, "Not a group chat");

  if (!isAdmin(chat, req.user._id))
    throw new ApiError(403, "Only an admin can distribute group keys");

  chat.encryptedGroupKeys = encryptedGroupKeys;
  await chat.save();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Group keys stored successfully"));
});

const getMyGroupKey = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!chat.isGroupChat) throw new ApiError(400, "Not a group chat");

  const myKey = chat.encryptedGroupKeys?.find(
    (k) => k.participantId.toString() === req.user._id.toString()
  );
  if (!myKey) throw new ApiError(404, "No encrypted key found for your account");

  return res
    .status(200)
    .json(new ApiResponse(200, myKey, "Group key fetched successfully"));
});

const checkParticipantE2EEStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const keys = await UserKey.findOne({ userId });
  return res.status(200).json(
    new ApiResponse(
      200,
      { userId, hasE2EEKeys: !!keys, registeredAt: keys?.createdAt ?? null },
      "E2EE status checked"
    )
  );
});

// ─── User search / status ─────────────────────────────────────────────────────

const searchAvailableUsers = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { lastSeen: new Date() } });
  const users = await User.aggregate([{ $match: { _id: { $ne: req.user._id } } }]);
  return res.status(200).json(new ApiResponse(200, users, "Users fetched successfully"));
});

const searchUsers = asyncHandler(async (req, res) => {
  const { query } = req.query;
  await User.updateOne({ _id: req.user._id }, { $set: { lastSeen: new Date() } });
  const users = await User.aggregate([
    {
      $match: {
        _id: { $ne: req.user._id },
        $or: [
          { username: { $regex: new RegExp(query, "i") } },
          { fullName: { $regex: new RegExp(query, "i") } },
        ],
      },
    },
  ]);
  return res.status(200).json(new ApiResponse(200, users, "Users fetched successfully"));
});

const getUserLastSeenHandler = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await User.updateOne({ _id: req.user._id }, { $set: { lastSeen: new Date() } });
  const user = await User.findById(userId);
  if (!user)
    return res.status(404).json({ status: 404, data: null, message: "User not found" });
  return res.status(200).json({
    status: 200,
    data: { lastSeen: user.lastSeen },
    message: "Last seen fetched successfully",
  });
});

const getUserStatus = async (userId) => {
  const isOnline = isUserActive(userId);
  let lastSeen = null;
  if (!isOnline) {
    const user = await User.findById(userId);
    lastSeen = user ? user.lastSeen : null;
  }
  return { isOnline, lastSeen };
};

// ─── 1-on-1 chat ──────────────────────────────────────────────────────────────

const createOrGetAOneOnOneChat = asyncHandler(async (req, res) => {
  const { receiverId } = req.params;
  const receiver = await User.findById(receiverId);
  if (!receiver) throw new ApiError(404, "Receiver does not exist");
  if (receiver._id.toString() === req.user._id.toString())
    throw new ApiError(400, "You cannot chat with yourself");

  const chat = await Chat.aggregate([
    {
      $match: {
        isGroupChat: false,
        $and: [
          { participants: { $elemMatch: { $eq: req.user._id } } },
          { participants: { $elemMatch: { $eq: new mongoose.Types.ObjectId(receiverId) } } },
        ],
      },
    },
    ...chatCommonAggregation(),
  ]);

  if (chat.length)
    return res.status(200).json(new ApiResponse(200, chat[0], "Chat retrieved successfully"));

  const newChatInstance = await Chat.create({
    name:         "One on One",
    participants: [req.user._id, new mongoose.Types.ObjectId(receiverId)],
    admin:        req.user._id,
  });

  const createdChat = await Chat.aggregate([
    { $match: { _id: newChatInstance._id } },
    ...chatCommonAggregation(),
  ]);

  const payload = createdChat[0];
  if (!payload) throw new ApiError(500, "Internal server error");

  payload?.participants?.forEach((participant) => {
    if (participant._id.toString() === req.user._id.toString()) return;
    emitSocketEvent(req, participant._id?.toString(), ChatEventEnum.NEW_CHAT_EVENT, payload);
  });

  return res.status(201).json(new ApiResponse(201, payload, "Chat retrieved successfully"));
});

// ─── Group chat reads ─────────────────────────────────────────────────────────

const getGroupChatDetails = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const groupChat = await Chat.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(chatId), isGroupChat: true } },
    ...chatCommonAggregation(),
  ]);
  const chat = groupChat[0];
  if (!chat) throw new ApiError(404, "Group chat does not exist");
  return res.status(200).json(new ApiResponse(200, chat, "Group chat fetched successfully"));
});

const getChatById = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const fetchedChat = await Chat.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(chatId) } },
    ...chatCommonAggregation(),
  ]);
  const chat = fetchedChat[0];
  if (!chat) throw new ApiError(404, "Chat does not exist");
  return res.status(200).json(new ApiResponse(200, chat, "Chat fetched successfully"));
});

const getAllChats = asyncHandler(async (req, res) => {
  const chats = await Chat.aggregate([
    { $match: { participants: { $elemMatch: { $eq: req.user._id } } } },
    { $sort: { updatedAt: -1 } },
    ...chatCommonAggregation(),
  ]);
  return res.status(200).json(new ApiResponse(200, chats || [], "User chats fetched successfully!"));
});

const getAllGroupChats = asyncHandler(async (req, res) => {
  const groups = await Chat.aggregate([
    {
      $match: {
        isGroupChat: true,
        participants: { $elemMatch: { $eq: req.user._id } },
      },
    },
    ...chatCommonAggregation(),
  ]);
  return res.status(200).json(new ApiResponse(200, groups, "Group chats fetched successfully"));
});

// ─── Group chat mutations ─────────────────────────────────────────────────────

const renameGroupChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { name } = req.body;

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });
  if (!groupChat) throw new ApiError(404, "Group chat does not exist");

  if (!groupChat.canManage(req.user._id))
    throw new ApiError(403, "Only admin or moderator can rename the group");

  const updatedGroupChat = await Chat.findByIdAndUpdate(
    chatId,
    { $set: { name } },
    { new: true }
  );

  const chat = await Chat.aggregate([
    { $match: { _id: updatedGroupChat._id } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload) throw new ApiError(500, "Internal server error");

  payload?.participants?.forEach((participant) => {
    emitSocketEvent(req, participant._id?.toString(), ChatEventEnum.UPDATE_GROUP_NAME_EVENT, payload);
  });

  return res.status(200).json(new ApiResponse(200, payload, "Group chat name updated successfully"));
});

const deleteGroupChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });
  if (!groupChat) throw new ApiError(404, "Group chat does not exist");

  if (!isAdmin(groupChat, req.user._id))
    throw new ApiError(403, "Only an admin can delete the group");

  const populatedChats = await Chat.aggregate([
    { $match: { _id: groupChat._id } },
    ...chatCommonAggregation(),
  ]);
  const populated = populatedChats[0];

  await Chat.findByIdAndDelete(chatId);
  await deleteCascadeChatMessages(chatId);

  populated?.participants?.forEach((participant) => {
    emitSocketEvent(req, participant._id?.toString(), ChatEventEnum.LEAVE_CHAT_EVENT, populated);
  });

  return res.status(200).json(new ApiResponse(200, {}, "Group chat deleted successfully"));
});

const deleteOneOnOneChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  const chat = await Chat.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(chatId) } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload) throw new ApiError(404, "Chat does not exist");

  await Chat.findByIdAndDelete(chatId);
  await deleteCascadeChatMessages(chatId);

  const otherParticipant = payload?.participants?.find(
    (p) => p?._id.toString() !== req.user._id.toString()
  );
  emitSocketEvent(req, otherParticipant._id?.toString(), ChatEventEnum.LEAVE_CHAT_EVENT, payload);

  return res.status(200).json(new ApiResponse(200, {}, "Chat deleted successfully"));
});

// ─── Participants ─────────────────────────────────────────────────────────────

const addNewParticipantInGroupChat = asyncHandler(async (req, res) => {
  const { chatId, participantId } = req.params;

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });
  if (!groupChat) throw new ApiError(404, "Group chat does not exist");

  if (!groupChat.canManage(req.user._id))
    throw new ApiError(403, "Only admin or moderator can add participants");

  const alreadyMember = groupChat.participants.some((p) => p.toString() === participantId);
  if (alreadyMember) throw new ApiError(409, "Participant already in the group chat");

  if (groupChat.members.length >= 2048)
    throw new ApiError(400, "This group has reached the maximum capacity of 2048 members");

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $push: {
        participants: new mongoose.Types.ObjectId(participantId),
        members: {
          user:     new mongoose.Types.ObjectId(participantId),
          role:     ROLES.MEMBER,
          joinedAt: new Date(),
          isMuted:  false,
        },
      },
    },
    { new: true }
  );

  const chat = await Chat.aggregate([
    { $match: { _id: updatedChat._id } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload) throw new ApiError(500, "Internal server error");

  emitSocketEvent(req, participantId, ChatEventEnum.NEW_CHAT_EVENT, payload);

  payload?.participants?.forEach((participant) => {
    if (participant._id.toString() === participantId) return;
    emitSocketEvent(req, participant._id?.toString(), "GROUP_MEMBER_JOINED", {
      chatId,
      newMember: participantId,
      addedBy:   req.user._id,
    });
  });

  return res.status(200).json(new ApiResponse(200, payload, "Participant added successfully"));
});

/**
 * Removal rules:
 *   - Admin     → can remove moderators and members (NOT other admins)
 *   - Moderator → can only remove regular members
 *   - Member    → cannot remove anyone
 *   Nobody removes themselves here — use the leave endpoint.
 */


const removeParticipantFromGroupChat = asyncHandler(async (req, res) => {
  const { chatId, participantId } = req.params;

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });
  if (!groupChat) throw new ApiError(404, "Group chat does not exist");

  // ✅ Get the removed user's info BEFORE removing them
  const removedUser = await User.findById(participantId);
  const removedUsername = removedUser?.username || "Someone";

  const requesterRole = getMemberRole(groupChat, req.user._id);
  const targetRole    = getMemberRole(groupChat, participantId);

  if (!requesterRole || requesterRole === ROLES.MEMBER)
    throw new ApiError(403, "Only admin or moderator can remove participants");

  if (participantId === req.user._id.toString())
    throw new ApiError(400, "Use the leave endpoint to remove yourself");

  if (requesterRole === ROLES.ADMIN && targetRole === ROLES.ADMIN)
    throw new ApiError(403, "Admins cannot remove other admins");

  if (requesterRole === ROLES.MODERATOR && targetRole !== ROLES.MEMBER)
    throw new ApiError(403, "Moderators can only remove regular members");

  const isMember = groupChat.participants.some((p) => p.toString() === participantId);
  if (!isMember) throw new ApiError(400, "Participant does not exist in the group chat");

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: {
        participants: new mongoose.Types.ObjectId(participantId),
        members:      { user: new mongoose.Types.ObjectId(participantId) },
      },
    },
    { new: true }
  );

  const chat = await Chat.aggregate([
    { $match: { _id: updatedChat._id } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload) throw new ApiError(500, "Internal server error");

  emitSocketEvent(req, participantId, ChatEventEnum.LEAVE_CHAT_EVENT, { chatId });

  payload?.participants?.forEach((participant) => {
    emitSocketEvent(req, participant._id?.toString(), "GROUP_MEMBER_REMOVED", {
      chatId,
      removedUserId: participantId,
      removedUsername: removedUsername,  // ✅ Add this
      removedBy:     req.user._id,
    });
  });

  return res.status(200).json(new ApiResponse(200, payload, "Participant removed successfully"));
});

const addMultipleParticipantsToGroupChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { participants } = req.body;

  if (!Array.isArray(participants) || participants.length === 0)
    throw new ApiError(400, "participants array is required");

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });
  if (!groupChat) throw new ApiError(404, "Group chat does not exist");

  if (!isAdmin(groupChat, req.user._id))
    throw new ApiError(403, "Only an admin can bulk-add participants");

  const existingIds     = groupChat.participants.map((p) => p.toString());
  const newParticipants = participants.filter((id) => !existingIds.includes(id));

  if (newParticipants.length === 0)
    throw new ApiError(409, "All selected users are already in the group");

  const spotsLeft = 2048 - groupChat.members.length;
  if (spotsLeft <= 0)
    throw new ApiError(400, "This group has reached the maximum capacity of 2048 members");

  // Trim the list if adding everyone would exceed the cap
  const toAdd = newParticipants.slice(0, spotsLeft);
  if (toAdd.length < newParticipants.length) {
    // We still proceed but only add as many as the cap allows
    newParticipants.length = 0;
    toAdd.forEach((id) => newParticipants.push(id));
  }

  const newMembers = newParticipants.map((userId) => ({
    user:     new mongoose.Types.ObjectId(userId),
    role:     ROLES.MEMBER,
    joinedAt: new Date(),
    isMuted:  false,
  }));

  await Chat.findByIdAndUpdate(chatId, {
    $push: {
      participants: { $each: newParticipants.map((id) => new mongoose.Types.ObjectId(id)) },
      members:      { $each: newMembers },
    },
  });

  const chat = await Chat.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(chatId) } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload) throw new ApiError(500, "Internal server error");

  newParticipants.forEach((participantId) => {
    emitSocketEvent(req, participantId, ChatEventEnum.NEW_CHAT_EVENT, payload);
  });
  existingIds.forEach((participantId) => {
    emitSocketEvent(req, participantId, "GROUP_MEMBER_JOINED", {
      chatId,
      newMembers: newParticipants,
      addedBy:    req.user._id,
    });
  });

  return res
    .status(200)
    .json(new ApiResponse(200, payload, `${newParticipants.length} participant(s) added successfully`));
});

// ─── Role management ──────────────────────────────────────────────────────────

/**
 * PATCH /group/:chatId/members/:userId/role
 *
 * Rules:
 *   - Only admins can change roles.
 *   - An admin CAN change another admin's role (demote peer admin → mod/member).
 *   - An admin CAN change their own role IF at least one other admin exists
 *     (last-admin self-demotion is blocked to prevent a leaderless group).
 *   - Promoting anyone to admin just adds another admin — no one is force-demoted.
 */
const changeMemberRole = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.params;
  const { role } = req.body;

  if (!Object.values(ROLES).includes(role))
    throw new ApiError(400, `Invalid role. Must be one of: ${Object.values(ROLES).join(", ")}`);

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });
  if (!groupChat) throw new ApiError(404, "Group chat does not exist");

  if (!isAdmin(groupChat, req.user._id))
    throw new ApiError(403, "Only an admin can change member roles");

  const targetMemberIndex = groupChat.members.findIndex(
    (m) => m.user.toString() === userId
  );
  if (targetMemberIndex === -1)
    throw new ApiError(404, "User is not a member of this group");

  // Last-admin self-demotion guard
  if (userId === req.user._id.toString() && role !== ROLES.ADMIN) {
    const adminCount = groupChat.members.filter((m) => m.role === ROLES.ADMIN).length;
    if (adminCount <= 1)
      throw new ApiError(
        400,
        "You are the only admin. Promote someone else to admin before stepping down."
      );
  }

  // Apply the new role
  groupChat.members[targetMemberIndex].role = role;
  groupChat.members[targetMemberIndex].promotedBy =
    role === ROLES.MODERATOR ? req.user._id : null;

  // Keep legacy top-level admin field consistent
  if (role === ROLES.ADMIN) {
    groupChat.admin = new mongoose.Types.ObjectId(userId);
  } else if (groupChat.admin.toString() === userId) {
    const anyAdmin = groupChat.members.find((m) => m.role === ROLES.ADMIN);
    if (anyAdmin) groupChat.admin = anyAdmin.user;
  }

  await groupChat.save();

  const chat = await Chat.aggregate([
    { $match: { _id: groupChat._id } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload) throw new ApiError(500, "Internal server error");

  payload?.participants?.forEach((participant) => {
    emitSocketEvent(req, participant._id?.toString(), "GROUP_ROLE_CHANGED", {
      chatId,
      userId,
      newRole:   role,
      changedBy: req.user._id,
    });
  });

  return res
    .status(200)
    .json(new ApiResponse(200, payload, `Member role updated to ${role} successfully`));
});

const getGroupMembers = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
    participants: { $elemMatch: { $eq: req.user._id } },
  });
  if (!groupChat)
    throw new ApiError(404, "Group chat does not exist or you are not a member");

  const chat = await Chat.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(chatId) } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload) throw new ApiError(500, "Internal server error");

  return res
    .status(200)
    .json(new ApiResponse(200, payload.members || [], "Group members fetched successfully"));
});

// ─── Mute / unmute (messaging permission) ────────────────────────────────────

/**
 * PATCH /group/:chatId/members/:userId/mute
 * Body: { isMuted: true | false }
 *
 * Muting prevents a member from sending messages in the group.
 * Think of it like WhatsApp's per-member message restriction.
 *
 * Who can mute whom:
 *   - Admin     → can mute/unmute anyone except other admins
 *   - Moderator → can mute/unmute regular members only
 *   - Member    → cannot mute anyone
 *
 * Admins are never mutable (they always keep messaging rights).
 * A user cannot mute themselves.
 */
const setMemberMuteStatus = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.params;
  const { isMuted } = req.body;

  if (typeof isMuted !== "boolean")
    throw new ApiError(400, "isMuted must be a boolean (true or false)");

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });
  if (!groupChat) throw new ApiError(404, "Group chat does not exist");

  const requesterRole = getMemberRole(groupChat, req.user._id);
  const targetRole    = getMemberRole(groupChat, userId);

  if (!requesterRole || requesterRole === ROLES.MEMBER)
    throw new ApiError(403, "Only admin or moderator can mute/unmute members");

  if (userId === req.user._id.toString())
    throw new ApiError(400, "You cannot mute yourself");

  // Admins cannot be muted — they always retain messaging rights
  if (targetRole === ROLES.ADMIN)
    throw new ApiError(403, "Admins cannot be muted");

  // Moderators can only mute/unmute regular members
  if (requesterRole === ROLES.MODERATOR && targetRole !== ROLES.MEMBER)
    throw new ApiError(403, "Moderators can only mute/unmute regular members");

  const targetMemberIndex = groupChat.members.findIndex(
    (m) => m.user.toString() === userId
  );
  if (targetMemberIndex === -1)
    throw new ApiError(404, "User is not a member of this group");

  groupChat.members[targetMemberIndex].isMuted = isMuted;
  await groupChat.save();

  const chat = await Chat.aggregate([
    { $match: { _id: groupChat._id } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload) throw new ApiError(500, "Internal server error");

  const eventName = isMuted ? "GROUP_MEMBER_MUTED" : "GROUP_MEMBER_UNMUTED";

  // Notify the affected user directly so their client can update the UI
  emitSocketEvent(req, userId, eventName, {
    chatId,
    userId,
    isMuted,
    changedBy: req.user._id,
  });

  // Notify all other participants so their member list refreshes
  payload?.participants?.forEach((participant) => {
    if (participant._id.toString() === userId) return;
    emitSocketEvent(req, participant._id?.toString(), eventName, {
      chatId,
      userId,
      isMuted,
      changedBy: req.user._id,
    });
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        payload,
        isMuted
          ? "Member has been muted and can no longer send messages"
          : "Member has been unmuted and can now send messages"
      )
    );
});

// ─── Leave group ──────────────────────────────────────────────────────────────

/**
 * Anyone can leave at any time. Three cases:
 *
 *  1. Last person → group auto-deletes.
 *  2. Last admin leaves (others remain) → oldest member is auto-promoted to admin.
 *  3. Normal leave → pulls the user, notifies everyone.
 */
const leaveGroupChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });
  if (!groupChat) throw new ApiError(404, "Group chat does not exist");

  const isMember = groupChat.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );
  if (!isMember) throw new ApiError(400, "You are not a part of this group chat");

  const otherParticipants = groupChat.participants.filter(
    (p) => p.toString() !== req.user._id.toString()
  );

  // ── Case 1: Last person ───────────────────────────────────────────────────
  if (otherParticipants.length === 0) {
    await Chat.findByIdAndDelete(chatId);
    await deleteCascadeChatMessages(chatId);
    emitSocketEvent(req, req.user._id.toString(), ChatEventEnum.LEAVE_CHAT_EVENT, { chatId });
    return res.status(200).json(new ApiResponse(200, {}, "You were the last member. Group deleted."));
  }

  // ── Case 2: Last admin leaves, others remain ──────────────────────────────
  const myRole = getMemberRole(groupChat, req.user._id);
  if (myRole === ROLES.ADMIN) {
    const remainingAdmins = groupChat.members.filter(
      (m) => m.role === ROLES.ADMIN && m.user.toString() !== req.user._id.toString()
    );

    if (remainingAdmins.length === 0) {
      await Chat.findByIdAndUpdate(chatId, {
        $pull: {
          participants: req.user._id,
          members:      { user: req.user._id },
        },
      });

      const refreshed  = await Chat.findById(chatId);
      const promotedId = await autoPromoteNextAdmin(refreshed);

      const chat = await Chat.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(chatId) } },
        ...chatCommonAggregation(),
      ]);
      const payload = chat[0];
      if (!payload) throw new ApiError(500, "Internal server error");

      payload?.participants?.forEach((participant) => {
        emitSocketEvent(req, participant._id?.toString(), "GROUP_MEMBER_LEFT", {
          chatId,
          userId:   req.user._id,
          username: req.user.username,
        });
        if (promotedId) {
          emitSocketEvent(req, participant._id?.toString(), "GROUP_ROLE_CHANGED", {
            chatId,
            userId:    promotedId,
            newRole:   ROLES.ADMIN,
            changedBy: null,
          });
        }
        emitSocketEvent(req, participant._id?.toString(), ChatEventEnum.UPDATE_GROUP_NAME_EVENT, payload);
      });

      emitSocketEvent(req, req.user._id.toString(), ChatEventEnum.LEAVE_CHAT_EVENT, { chatId });

      return res.status(200).json(
        new ApiResponse(
          200,
          payload,
          promotedId
            ? "Left the group. Another member was automatically promoted to admin."
            : "Left the group successfully."
        )
      );
    }
  }

  // ── Case 3: Normal leave ──────────────────────────────────────────────────
  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: {
        participants: req.user._id,
        members:      { user: req.user._id },
      },
    },
    { new: true }
  );

  const chat = await Chat.aggregate([
    { $match: { _id: updatedChat._id } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload) throw new ApiError(500, "Internal server error");

  payload?.participants?.forEach((participant) => {
    emitSocketEvent(req, participant._id?.toString(), "GROUP_MEMBER_LEFT", {
      chatId,
      userId:   req.user._id,
      username: req.user.username,
    });
    emitSocketEvent(req, participant._id?.toString(), ChatEventEnum.UPDATE_GROUP_NAME_EVENT, payload);
  });

  emitSocketEvent(req, req.user._id.toString(), ChatEventEnum.LEAVE_CHAT_EVENT, { chatId });

  return res.status(200).json(new ApiResponse(200, payload, "Left the group successfully"));
});

// ─── Group chat creation ──────────────────────────────────────────────────────

const createAGroupChat = asyncHandler(async (req, res) => {
  const { name, participants } = req.body;

  if (!name || !name.trim()) throw new ApiError(400, "Group name is required");

  if (!Array.isArray(participants) || participants.length === 0)
    throw new ApiError(400, "At least one participant is required");

  if (participants.includes(req.user._id.toString()))
    throw new ApiError(400, "Participants array should not contain the group creator");

  const members = [...new Set([...participants, req.user._id.toString()])];

  if (members.length < 3)
    throw new ApiError(400, "A group chat requires at least 3 members (including you).");

  const membersWithRoles = members.map((userId) => ({
    user:     new mongoose.Types.ObjectId(userId),
    role:     userId === req.user._id.toString() ? ROLES.ADMIN : ROLES.MEMBER,
    joinedAt: new Date(),
    isMuted:  false,
  }));

  const groupChat = await Chat.create({
    name:         name.trim(),
    isGroupChat:  true,
    participants: members.map((id) => new mongoose.Types.ObjectId(id)),
    members:      membersWithRoles,
    admin:        req.user._id,
  });

  const savedChat = await Chat.findById(groupChat._id);
  if (!savedChat) throw new ApiError(500, "Failed to save group chat");

  const chat = await Chat.aggregate([
    { $match: { _id: savedChat._id } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload)
    throw new ApiError(500, "Group was created but could not be retrieved. Please refresh.");

  const responsePayload = {
    ...payload,
    _id:   payload._id.toString(),
    admin: payload.admin?.toString?.() ?? payload.admin,
  };

  payload?.participants?.forEach((participant) => {
    if (participant._id.toString() === req.user._id.toString()) return;
    emitSocketEvent(req, participant._id?.toString(), ChatEventEnum.NEW_CHAT_EVENT, responsePayload);
  });

  return res.status(201).json(new ApiResponse(201, responsePayload, "Group chat created successfully"));
});

// ─── Invite link ──────────────────────────────────────────────────────────────

const generateGroupInviteLink = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(chatId))
    throw new ApiError(400, "Invalid chat ID");

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });
  if (!groupChat) throw new ApiError(404, "Group chat does not exist");

  const isMember = groupChat.participants.some((p) => p.toString() === req.user._id.toString());
  if (!isMember) throw new ApiError(403, "You are not a member of this group");

  if (!groupChat.canManage(req.user._id))
    throw new ApiError(403, "Only admin or moderator can generate an invite link");

  const token = groupChat.generateInviteToken(req.user._id);
  await groupChat.save();

  const APP_SCHEME = process.env.APP_DEEP_LINK_SCHEME || "circuit";
  const WEB_BASE   = process.env.APP_BASE_URL         || "https://yourapp.com";

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        inviteLink:  `${APP_SCHEME}://join/group/${token}`,
        webFallback: `${WEB_BASE}/join/group/${token}`,
        inviteToken: token,
        generatedBy: req.user._id,
      },
      "Invite link generated successfully"
    )
  );
});

const revokeGroupInviteLink = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });
  if (!groupChat) throw new ApiError(404, "Group chat does not exist");

  if (!isAdmin(groupChat, req.user._id))
    throw new ApiError(403, "Only an admin can revoke the invite link");

  groupChat.inviteToken            = null;
  groupChat.inviteTokenEnabled     = false;
  groupChat.inviteTokenGeneratedBy = null;
  await groupChat.save();

  return res.status(200).json(new ApiResponse(200, {}, "Invite link revoked successfully"));
});

const joinGroupViaInviteLink = asyncHandler(async (req, res) => {
  const { inviteToken } = req.params;
  if (!inviteToken) throw new ApiError(400, "Invite token is required");

  const groupChat = await Chat.findOne({
    inviteToken,
    inviteTokenEnabled: true,
    isGroupChat: true,
  });
  if (!groupChat)
    throw new ApiError(404, "Invalid or expired invite link. Ask an admin to generate a new one.");

  const alreadyMember = groupChat.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );

  if (alreadyMember) {
    const chat = await Chat.aggregate([
      { $match: { _id: groupChat._id } },
      ...chatCommonAggregation(),
    ]);
    return res.status(200).json(new ApiResponse(200, chat[0], "You are already a member of this group"));
  }

  if (groupChat.members.length >= 2048)
    throw new ApiError(400, "This group is full. It has reached the maximum capacity of 2048 members");

  await Chat.findByIdAndUpdate(groupChat._id, {
    $push: {
      participants: req.user._id,
      members: {
        user:     req.user._id,
        role:     ROLES.MEMBER,
        joinedAt: new Date(),
        isMuted:  false,
      },
    },
  });

  const chat = await Chat.aggregate([
    { $match: { _id: groupChat._id } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload) throw new ApiError(500, "Internal server error");

  payload?.participants?.forEach((participant) => {
    if (participant._id.toString() === req.user._id.toString()) return;
    emitSocketEvent(req, participant._id?.toString(), "GROUP_MEMBER_JOINED", {
      chatId:    groupChat._id,
      newMember: req.user._id,
      groupName: groupChat.name,
    });
    emitSocketEvent(req, participant._id?.toString(), ChatEventEnum.UPDATE_GROUP_NAME_EVENT, payload);
  });

  emitSocketEvent(req, req.user._id.toString(), ChatEventEnum.NEW_CHAT_EVENT, payload);

  return res.status(200).json(new ApiResponse(200, payload, "Joined group successfully"));
});

// ─── Group avatar ─────────────────────────────────────────────────────────────

const updateGroupAvatar = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });
  if (!groupChat) throw new ApiError(404, "Group chat does not exist");

  if (!groupChat.canManage(req.user._id))
    throw new ApiError(403, "Only admin or moderator can update the group photo");

  if (!req.file) throw new ApiError(400, "Avatar image is required");

  if (groupChat.avatar?.localPath) removeLocalFile(groupChat.avatar.localPath);

  groupChat.avatar = {
    url:       `${process.env.BASE_URL || "http://192.168.1.103:8080"}/profileimages/${req.file.filename}`,
    localPath: req.file.path.replace(/\\/g, "/"),
  };
  await groupChat.save();

  const chat = await Chat.aggregate([
    { $match: { _id: groupChat._id } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload) throw new ApiError(500, "Internal server error");

  payload?.participants?.forEach((participant) => {
    emitSocketEvent(req, participant._id?.toString(), ChatEventEnum.UPDATE_GROUP_NAME_EVENT, payload);
  });

  return res.status(200).json(new ApiResponse(200, payload, "Group avatar updated successfully"));
});

const updateGroupPermissions = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { editInfoLocked } = req.body;

  if (typeof editInfoLocked !== "boolean")
    throw new ApiError(400, "editInfoLocked must be a boolean");

  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });
  if (!groupChat) throw new ApiError(404, "Group chat does not exist");

  if (!isAdmin(groupChat, req.user._id))
    throw new ApiError(403, "Only an admin can change group permissions");

  groupChat.editInfoLocked = editInfoLocked;
  await groupChat.save();

  const chat = await Chat.aggregate([
    { $match: { _id: groupChat._id } },
    ...chatCommonAggregation(),
  ]);
  const payload = chat[0];
  if (!payload) throw new ApiError(500, "Internal server error");

  payload?.participants?.forEach((participant) => {
    emitSocketEvent(req, participant._id?.toString(), "GROUP_PERMISSIONS_CHANGED", {
      chatId,
      editInfoLocked,
      changedBy: req.user._id,
    });
  });

  return res
    .status(200)
    .json(new ApiResponse(200, payload, "Group permissions updated successfully"));
});

const reportGroup = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { reason, targetType = "group" } = req.body;

  if (!reason) throw new ApiError(400, "Reason is required");

  const groupChat = await Chat.findById(chatId);
  if (!groupChat) throw new ApiError(404, "Group not found");

  // You can create a Report model later — for now log it
  console.log(`REPORT: user=${req.user._id} target=${chatId} type=${targetType} reason="${reason}"`);

  return res.status(200).json(new ApiResponse(200, {}, "Report submitted successfully"));
});

export {
  addNewParticipantInGroupChat,
  createAGroupChat,
  createOrGetAOneOnOneChat,
  deleteGroupChat,
  deleteOneOnOneChat,
  getAllChats,
  getGroupChatDetails,
  getChatById,
  leaveGroupChat,
  removeParticipantFromGroupChat,
  renameGroupChat,
  searchAvailableUsers,
  getUserLastSeenHandler,
  getUserStatus,
  searchUsers,
  storeGroupEncryptedKeys,
  getMyGroupKey,
  checkParticipantE2EEStatus,
  getAllGroupChats,
  changeMemberRole,
  getGroupMembers,
  setMemberMuteStatus,       
  generateGroupInviteLink,
  revokeGroupInviteLink,
  joinGroupViaInviteLink,
  updateGroupAvatar,
  addMultipleParticipantsToGroupChat,
  updateGroupPermissions,
  reportGroup,
};