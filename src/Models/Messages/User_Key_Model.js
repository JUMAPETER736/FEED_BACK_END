import mongoose, { Schema } from "mongoose";

const userKeySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    x25519PublicKey: {
      type: String,
      required: true,    // ECDH public key for key exchange (base64)
    },
    ed25519PublicKey: {
      type: String,
      required: true,    // Signing public key — verifies key ownership (base64)
    },
    keySignature: {
      type: String,
      required: true,    // x25519PublicKey signed with ed25519PrivateKey
    },
    oneTimePreKeys: [
      {
        keyId: { type: Number },
        publicKey: { type: String },  // base64, consumed one per new session
      },
    ],
  },
  { timestamps: true }
);

export const UserKey = mongoose.model("UserKey", userKeySchema);