import mongoose, { Schema } from "mongoose";

const chatMessageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Plaintext (null when End To End Encryption is active)
    content: {
      type: String,
      default: "",
    },

    // End To End Encryptions fields (populated only when isEncrypted: true)
    encryptedContent: {
      type: String,       // For the base64 AES-256-GCM ciphertext
      default: null,
    },
    iv: {
      type: String,       // For the base64 GCM nonce (12 bytes)
      default: null,
    },
    ephemeralPublicKey: {
      type: String,       // For the base64 X25519 sender ephemeral pubkey (1-on-1 only)
      default: null,
    },
    isEncrypted: {
      type: Boolean,
      default: false,
    },
   

    attachments: {
      type: [
        {
          url: String,
          localPath: String,
        },
      ],
      default: [],
    },

    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
    },

    receivedParticipants: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);