import axios from "axios";
import TryCatch from "../config/tryCatch.js";
import type { AuthenticatedRequest } from "../middleware/isAuth.js";
import { Chat } from "../models/chat.js";
import { Message } from "../models/messages.js";
import { getRecieverSocketId, io } from "../config/socket.js";

/* ================= CREATE NEW CHAT ================= */
export const createNewChat = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { otherUserId } = req.body;

    if (!otherUserId) {
      return res.status(400).json({ message: "otherUserId is required" });
    }

    const existingChat = await Chat.findOne({
      users: { $all: [userId, otherUserId], $size: 2 },
    });

    if (existingChat) {
      return res.status(200).json({
        message: "Chat already exists",
        chatId: existingChat._id,
      });
    }

    const newChat = await Chat.create({
      users: [userId, otherUserId],
    });

    res.status(201).json({
      message: "New chat created",
      chatId: newChat._id,
    });
  }
);

/* ================= GET ALL CHATS ================= */
export const getAllChats = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;

  if (!userId) {
    return res.status(400).json({ message: "UserId not found" });
  }

  const chats = await Chat.find({ users: userId }).sort({ updatedAt: -1 });

  const chatWithUserData = await Promise.all(
    chats.map(async (chat) => {
      const otherUserId = chat.users.find(
        (id) => id.toString() !== userId.toString()
      );

      const unseenCount = await Message.countDocuments({
        chatId: chat._id,
        sender: { $ne: userId },
        seen: false,
      });

      try {
        const authHeader = req.headers.authorization as string;

        const { data } = await axios.get(
          `${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`,
          {
            headers: { Authorization: authHeader },
          }
        );

        return {
          user: data,
          chat: {
            ...chat.toObject(),
            latestMessage: chat.latestMessage || null,
            unseenCount,
          },
        };
      } catch (error) {
        console.error(error);
        return {
          user: { _id: otherUserId, name: "Unknown User" },
          chat: {
            ...chat.toObject(),
            latestMessage: chat.latestMessage || null,
            unseenCount,
          },
        };
      }
    })
  );

  res.status(200).json({ chats: chatWithUserData });
});

/* ================= SEND MESSAGE ================= */
export const sendMessage = TryCatch(async (req: AuthenticatedRequest, res) => {
  const senderId = req.user?._id;
  const { chatId, text } = req.body;
  const imageFile = req.file;

  if (!senderId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!chatId) {
    return res.status(400).json({ message: "chatId is required" });
  }

  if (!text && !imageFile) {
    return res
      .status(400)
      .json({ message: "Either text or image is required" });
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }

  const isUserInChat = chat.users.some(
    (id) => id.toString() === senderId.toString()
  );

  if (!isUserInChat) {
    return res
      .status(403)
      .json({ message: "You are not a participant of this chat" });
  }

  const otherUserId = chat.users.find(
    (id) => id.toString() !== senderId.toString()
  );

  if (!otherUserId) {
    return res.status(401).json({ message: "No other user" });
  }

  /* ---------- SOCKET PRESENCE CHECK ---------- */
  const receiverSocketId = getRecieverSocketId(otherUserId.toString());
  let isReceiverInChatRoom = false;

  if (receiverSocketId) {
    const receiverSocket = io.sockets.sockets.get(receiverSocketId);
    if (receiverSocket && receiverSocket.rooms.has(chatId)) {
      isReceiverInChatRoom = true;
    }
  }

  /* ---------- MESSAGE DATA ---------- */
  const messageData: any = {
    chatId,
    sender: senderId,
    seen: isReceiverInChatRoom,
    seenAt: isReceiverInChatRoom ? new Date() : undefined,
  };

  if (imageFile) {
    messageData.image = {
      url: imageFile.path,
      publicId: imageFile.filename,
    };
    messageData.messageType = "image";
    messageData.text = text || "";
  } else {
    messageData.text = text;
    messageData.messageType = "text";
  }

  const savedMessage = await new Message(messageData).save();

  const latestMessageText = imageFile ? "📷 Image" : text;

  await Chat.findByIdAndUpdate(chatId, {
    latestMessage: {
      text: latestMessageText,
      sender: senderId,
    },
    updatedAt: new Date(),
  });

  /* ---------- SOCKET EMITS ---------- */
  io.to(chatId).emit("newMessage", savedMessage);

  if (receiverSocketId) {
    io.to(receiverSocketId).emit("newMessage", savedMessage);
  }

  const senderSocketId = getRecieverSocketId(senderId.toString());
  if (senderSocketId) {
    io.to(senderSocketId).emit("newMessage", savedMessage);
  }

  if (isReceiverInChatRoom && senderSocketId) {
    io.to(senderSocketId).emit("messagesSeen", {
      chatId,
      seenBy: otherUserId,
      messageIds: [savedMessage._id],
    });
  }

  res.status(201).json({ message: savedMessage, sender: senderId });
});

/* ================= GET MESSAGES BY CHAT ================= */
export const getMessagesByChat = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { chatId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!chatId) {
      return res.status(400).json({ message: "chatId is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const isUserInChat = chat.users.some(
      (id) => id.toString() === userId.toString()
    );

    if (!isUserInChat) {
      return res
        .status(403)
        .json({ message: "You are not a participant of this chat" });
    }

    const messagesToMarkSeen = await Message.find({
      chatId,
      sender: { $ne: userId },
      seen: false,
    });

    await Message.updateMany(
      {
        chatId,
        sender: { $ne: userId },
        seen: false,
      },
      { seen: true, seenAt: new Date() }
    );

    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });

    const otherUserId = chat.users.find(
      (id) => id.toString() !== userId.toString()
    );

    try {
      const authHeader = req.headers.authorization as string;

      const { data } = await axios.get(
        `${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`,
        { headers: { Authorization: authHeader } }
      );

      if (messagesToMarkSeen.length > 0) {
        const otherUserSocketId = getRecieverSocketId(otherUserId.toString());
        if (otherUserSocketId) {
          io.to(otherUserSocketId).emit("messagesSeen", {
            chatId,
            seenBy: userId,
            messageIds: messagesToMarkSeen.map((m) => m._id),
          });
        }
      }

      res.status(200).json({ messages, user: data });
    } catch (error) {
      console.error(error);
      res.json({
        messages,
        user: { _id: otherUserId, name: "Unknown User" },
      });
    }
  }
);
