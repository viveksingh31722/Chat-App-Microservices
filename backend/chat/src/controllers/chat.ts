import axios from "axios";
import TryCatch from "../config/tryCatch.js";
import type { AuthenticatedRequest } from "../middleware/isAuth.js";
import { Chat } from "../models/chat.js";
import { Message } from "../models/messages.js";

export const createNewChat = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { otherUserId } = req.body;

    if (!otherUserId) {
      res.status(400).json({ message: "otherUserId is required" });
      return;
    }

    // Logic to create a new chat between userId and otherUserId
    const existingChat = await Chat.findOne({
      users: { $all: [userId, otherUserId], $size: 2 },
    });

    if (existingChat) {
      return res
        .status(200)
        .json({ message: "Chat already exists", chatId: existingChat._id });
    }

    const newChat = await Chat.create({
      users: [userId, otherUserId],
    });

    res.status(201).json({ message: "New chat created", chatId: newChat._id });
  }
);

export const getAllChats = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;

  if (!userId) {
    return res.status(400).json({ message: "UserId not found" });
  }

  const chats = await Chat.find({ users: userId }).sort({ updatedAt: -1 });

  const chatWithUserData = await Promise.all(
    chats.map(async (chat) => {
      const otherUserId = chat.users.find((id) => id !== userId);

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
            headers: {
              Authorization: authHeader,
            },
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
        console.log(error);
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

export const sendMessage = TryCatch(async (req: AuthenticatedRequest, res) => {
  // implementation for sending a message
  const senderId = req.user?._id;
  const { chatId, text } = req.body;
  const imageFile = req.file;

  if (!senderId) {
    return res.status(401).json({ Message: "Unauthorized" });
  }

  if (!chatId) {
    return res.status(400).json({ Message: "chatId is required" });
  }

  if (!text && !imageFile) {
    return res
      .status(400)
      .json({ Message: "Either text or image is required" });
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return res.status(404).json({ Message: "Chat not found" });
  }

  const isUserInChat = chat.users.some(
    (userId) => userId.toString() === senderId.toString()
  );

  if (!isUserInChat) {
    return res
      .status(403)
      .json({ Message: "You are not a participant of this chat" });
  }

  const otherUserId = chat.users.find(
    (userId) => userId.toString() !== senderId.toString()
  );

  if (!otherUserId) {
    return res.status(401).json({ Message: "No other user" });
  }

  //Socket.io event emission logic can be added here

  let messageData: any = {
    chatId: chatId,
    sender: senderId,
    seen: false,
    seenAt: undefined,
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

  const newMessage = new Message(messageData);

  const savedMessage = await newMessage.save();

  const latestMessageText = imageFile ? "📷 Image" : text;

  await Chat.findByIdAndUpdate(
    chatId,
    {
      latestMessage: {
        text: latestMessageText,
        sender: senderId,
      },
      updatedAt: new Date(),
    },
    { new: true }
  );

  // emit to socket.io here

  res.status(201).json({ message: savedMessage, sender: senderId });
});

export const getMessagesByChat = TryCatch( // Its for open chat screen.
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { chatId } = req.params;

    if (!userId) {
      return res.status(401).json({ Message: "Unauthorized" });
    }

    if (!chatId) {
      return res.status(400).json({ Message: "chatId is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ Message: "Chat not found" });
    }

    const isUserInChat = chat.users.some(
      (userId) => userId.toString() === userId.toString()
    );

    if (!isUserInChat) {
      return res
        .status(403)
        .json({ Message: "You are not a participant of this chat" });
    }

    const messagesToMarkSeen = await Message.find({
      chatId: chatId,
      sender: { $ne: userId },
      seen: false,
    });

    await Message.updateMany(
      {
        chatId: chatId,
        sender: { $ne: userId },
        seen: false,
      },
      {
        seen: true,
        seenAt: new Date(),
      }
    );

    const messages = await Message.find({ chatId: chatId }).sort({
      createdAt: 1,
    });

    const otherUserId = chat.users.find((id) => id !== userId);

    try {
      const authHeader = req.headers.authorization as string;
      const { data } = await axios.get(
        `${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );
      if (!otherUserId) {
        return res.status(400).json({ message: "Other user not found" });
      }

      // Socket work

      res.status(200).json({ messages, user: data });
    } catch (error) {
      console.log(error);
      res.json({ messages, user: { _id: otherUserId, name: "Unknown User" } });
    }
  }
);
