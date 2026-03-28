import { Router } from "express";
import {
  addNewParticipantInGroupChat,
  createAGroupChat,
  createOrGetAOneOnOneChat,
  deleteGroupChat,
  deleteOneOnOneChat,
  getAllChats,
  getGroupChatDetails,
  leaveGroupChat,
  removeParticipantFromGroupChat,
  renameGroupChat,
  searchAvailableUsers,
  getUserLastSeenHandler,
  getUserStatus,
  getChatById,
  searchUsers,
  storeGroupEncryptedKeys,
  getMyGroupKey,
  checkParticipantE2EEStatus,
  changeMemberRole,
  getGroupMembers,
  setMemberMuteStatus,
  generateGroupInviteLink,
  revokeGroupInviteLink,
  joinGroupViaInviteLink,
  getAllGroupChats,
  updateGroupAvatar,
  addMultipleParticipantsToGroupChat,
  updateGroupPermissions,
  reportGroup,
} from "../../../controllers/apps/chat-app/chat.controllers.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import { upload } from "../../../middlewares/multer.middlewares.js";
import {
  createAGroupChatValidator,
  updateGroupChatNameValidator,
} from "../../../validators/apps/chat-app/chat.validators.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";
import { validate } from "../../../validators/validate.js";

const router = Router();

router.use(verifyJWT);

//  Chat list 

router.route("/").get(getAllChats);
router.route("/fetchChat/:chatId").get(getChatById);
router.route("/groups").get(getAllGroupChats);

//  User search & status 

router.route("/users").get(searchAvailableUsers);
router.route("/users/search").get(searchUsers);
router.route("/users/:userId/lastseen").get(getUserLastSeenHandler);

router.route("/users/user-status/:userId").get(async (req, res) => {
  try {
    const userStatus = await getUserStatus(req.params.userId);
    res.status(200).json(userStatus);
  } catch (error) {
    console.error("Error checking user status:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router
  .route("/users/:userId/e2ee-status")
  .get(mongoIdPathVariableValidator("userId"), validate, checkParticipantE2EEStatus);

//  1-on-1 chat 

router
  .route("/c/:receiverId")
  .post(mongoIdPathVariableValidator("receiverId"), validate, createOrGetAOneOnOneChat);

//  Group: create

router
  .route("/group")
  .post(createAGroupChatValidator(), validate, createAGroupChat);

//  Group: join via invite link 
// Must be declared BEFORE /group/:chatId so Express does not treat "join" as a chatId param.

router.route("/group/join/:inviteToken").post(joinGroupViaInviteLink);

//  Group: permissions 

router
  .route("/group/:chatId/permissions")
  .patch(mongoIdPathVariableValidator("chatId"), validate, updateGroupPermissions);

//  Group: report 

router
  .route("/group/:chatId/report")
  .post(mongoIdPathVariableValidator("chatId"), validate, reportGroup);

//  Group: avatar 

router
  .route("/group/:chatId/avatar")
  .patch(
    mongoIdPathVariableValidator("chatId"),
    validate,
    upload.single("avatar"),
    updateGroupAvatar
  );

//  Group: bulk-add participants 

router
  .route("/group/:chatId/participants")
  .post(mongoIdPathVariableValidator("chatId"), validate, addMultipleParticipantsToGroupChat);

// Group: E2EE key distribution

router
  .route("/group/:chatId/keys")
  .post(mongoIdPathVariableValidator("chatId"), validate, storeGroupEncryptedKeys)
  .get(mongoIdPathVariableValidator("chatId"), validate, getMyGroupKey);

//  Group: members list 

router
  .route("/group/:chatId/members")
  .get(mongoIdPathVariableValidator("chatId"), validate, getGroupMembers);

//  Group: change a member's role 

router
  .route("/group/:chatId/members/:userId/role")
  .patch(
    mongoIdPathVariableValidator("chatId"),
    mongoIdPathVariableValidator("userId"),
    validate,
    changeMemberRole
  );

//  Group: mute / unmute a member 

router
  .route("/group/:chatId/members/:userId/mute")
  .patch(
    mongoIdPathVariableValidator("chatId"),
    mongoIdPathVariableValidator("userId"),
    validate,
    setMemberMuteStatus
  );

//  Group: invite link management 

router
  .route("/group/:chatId/link")
  .post(mongoIdPathVariableValidator("chatId"), validate, generateGroupInviteLink)
  .delete(mongoIdPathVariableValidator("chatId"), validate, revokeGroupInviteLink);

// Group: details / rename / delete 

router
  .route("/group/:chatId")
  .get(mongoIdPathVariableValidator("chatId"), validate, getGroupChatDetails)
  .patch(
    mongoIdPathVariableValidator("chatId"),
    updateGroupChatNameValidator(),
    validate,
    renameGroupChat
  )
  .delete(mongoIdPathVariableValidator("chatId"), validate, deleteGroupChat);

//  Group: add / remove a single participant 

router
  .route("/group/:chatId/:participantId")
  .post(
    mongoIdPathVariableValidator("chatId"),
    mongoIdPathVariableValidator("participantId"),
    validate,
    addNewParticipantInGroupChat
  )
  .delete(
    mongoIdPathVariableValidator("chatId"),
    mongoIdPathVariableValidator("participantId"),
    validate,
    removeParticipantFromGroupChat
  );

// Leave / delete 

router
  .route("/leave/group/:chatId")
  .delete(mongoIdPathVariableValidator("chatId"), validate, leaveGroupChat);

router
  .route("/remove/:chatId")
  .delete(mongoIdPathVariableValidator("chatId"), validate, deleteOneOnOneChat);

export default router;