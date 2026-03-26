import mongoose, { Schema } from "mongoose";
import crypto from "crypto";

const chatSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    avatar: {
      url:       { type: String, default: "" },
      localPath: { type: String, default: "" },
    },

    isGroupChat: {
      type:    Boolean,
      default: false,
    },

    lastMessage: {
      type: Schema.Types.ObjectId,
      ref:  "ChatMessage",
    },

    participants: [
      {
        type: Schema.Types.ObjectId,
        ref:  "User",
      },
    ],

    members: {
      type: [
        {
          user: {
            type:     Schema.Types.ObjectId,
            ref:      "User",
            required: true,
          },
          role: {
            type:    String,
            enum:    ["admin", "moderator", "member"],
            default: "member",
          },
          joinedAt: {
            type:    Date,
            default: Date.now,
          },
          promotedBy: {
            type:    Schema.Types.ObjectId,
            ref:     "User",
            default: null,
          },
          isMuted: {
            type:    Boolean,
            default: false,
          },
        },
      ],
      validate: {
        validator: function (val) {
          return val.length <= 2048;
        },
        message: "A group cannot have more than 2048 members",
      },
    },

    admin: {
      type: Schema.Types.ObjectId,
      ref:  "User",
    },

    editInfoLocked: {
      type:    Boolean,
      default: false,
    },

    inviteToken: {
      type:    String,
      default: null,
      sparse:  true,
    },
    inviteTokenEnabled: {
      type:    Boolean,
      default: false,
    },
    inviteTokenGeneratedBy: {
      type:    Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },

    encryptedGroupKeys: [
      {
        participantId: {
          type: Schema.Types.ObjectId,
          ref:  "User",
        },
        encryptedKey: { type: String },
        nonce:        { type: String },
      },
    ],
  },
  { timestamps: true }
);

// ─── Instance helpers ─────────────────────────────────────────────────────────

chatSchema.methods.getMemberRole = function (userId) {
  const entry = this.members.find(
    (m) => m.user.toString() === userId.toString()
  );
  return entry ? entry.role : null;
};

chatSchema.methods.canManage = function (userId) {
  const role = this.getMemberRole(userId);
  return role === "admin" || role === "moderator";
};

chatSchema.methods.isAdmin = function (userId) {
  return this.getMemberRole(userId) === "admin";
};

chatSchema.methods.isMemberMuted = function (userId) {
  const entry = this.members.find(
    (m) => m.user.toString() === userId.toString()
  );
  return entry ? !!entry.isMuted : false;
};

chatSchema.methods.generateInviteToken = function (generatedBy) {
  this.inviteToken            = crypto.randomBytes(16).toString("hex");
  this.inviteTokenEnabled     = true;
  this.inviteTokenGeneratedBy = generatedBy;
  return this.inviteToken;
};

export const Chat = mongoose.model("Chat", chatSchema);

// ─── Report model ─────────────────────────────────────────────────────────────

const reportSchema = new Schema(
  {
    reportedBy: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    targetId: {
      type:     String,
      required: true,
    },
    targetType: {
      type:    String,
      enum:    ["group", "user", "message", "post"],
      default: "group",
    },
    reason: {
      type:     String,
      required: true,
    },
    status: {
      type:    String,
      enum:    ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

reportSchema.index({ reportedBy: 1, targetId: 1, targetType: 1, status: 1 });

export const Report = mongoose.model("Report", reportSchema);