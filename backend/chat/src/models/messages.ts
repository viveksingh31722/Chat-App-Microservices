import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMessage extends Document {
  chatId: Types.ObjectId;
  sender: string;
  text?: string;
  images?: {
    url: string;
    publicId: string;
  };
  messageType: "text" | "image";
  seen: boolean;
  seenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema: Schema<IMessage> = new Schema(
  {
    chatId: { type: Types.ObjectId, ref: "Chat", required: true },
    sender: { type: String, required: true },
    text: { type: String },
    images: {
      url: { type: String },
      publicId: { type: String },
    },
    messageType: { type: String, enum: ["text", "image"], default: "text" },
    seen: { type: Boolean, default: false },
    seenAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

export const Message = mongoose.model<IMessage>("Message", messageSchema);
