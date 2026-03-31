import mongoose from "mongoose";
import { ChatEventEnum } from "../../../Constants.js";
import { Chat }        from "../../../Models/Messages/Chats_Model.js";
import { ChatMessage } from "../../../Models/Messages/Messages_Model.js";
import { emitSocketEvent } from "../../../Sockets/index.js";
import { ApiError }    from "../../../Utils/API_Errors.js";
import { ApiResponse } from "../../../Utils/API_Response.js";
import { asyncHandler } from "../../../Utils/Async_Handler.js";
import {
  getLocalPath,
  getStaticFilePath,
  removeLocalFile,
} from "../../../Utils/Helpers.js";
import { User } from "../../../models/apps/auth/user.models.js";
// import { checkAndDeleteMessages } from "../../../utils/groupChatHelper.js";

/**
 * @description Utility function which returns the pipeline stages to structure the chat message schema with common lookups
 * @returns {mongoose.PipelineStage[]}
 */
const chatMessageCommonAggregation = () => {
  return [
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "sender",
        as: "sender",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
              email: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        sender: { $first: "$sender" },
      },
    },
  ];
};

const deleteMessages = async (chatId, userId) => {
  // fetch the messages associated with the chat to remove
  const messages = await ChatMessage.find({
    chat: new mongoose.Types.ObjectId(chatId),
  });

  let attachments = [];

  // get the attachments present in the messages
  attachments = attachments.concat(
    ...messages.map((message) => {
      return message.attachments;
    })
  );

  attachments.forEach((attachment) => {
    // remove attachment files from the local storage
    removeLocalFile(attachment.localPath);
  });

  // delete all the messages
  // await ChatMessage.deleteMany({
  //   chat: new mongoose.Types.ObjectId(chatId),
  // });

  await ChatMessage.deleteMany({
    chat: new mongoose.Types.ObjectId(chatId),
    "sender._id": { $ne: userId }, // Exclude messages sent by the logged-in user
  });
};

const deleteTextMessages = async (chatId, userId) => {
  try {
    // Fetch the messages associated with the chat to remove
    const messages = await ChatMessage.find({
      chat: new mongoose.Types.ObjectId(chatId),
    });

    // Filter messages with no attachments
    const messagesWithoutAttachments = messages.filter(
      (message) => !message.attachments || message.attachments.length === 0
    );

    // // Delete messages with no attachments
    // await ChatMessage.deleteMany({
    //   _id: { $in: messagesWithoutAttachments.map((message) => message._id) },
    // });

    // Delete messages sent by other users but keep those with attachments
    await ChatMessage.deleteMany({
      chat: new mongoose.Types.ObjectId(chatId),
      "sender._id": { $ne: userId },
      attachments: { $exists: false }, // Exclude messages with attachments
    });

    console.log("Messages deleted successfully.");
  } catch (error) {
    console.error("Error deleting messages:", error);
  }
};

const getAllMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  // const user = req.user

  const selectedChat = await Chat.findById(chatId);

  if (!selectedChat) {
    throw new ApiError(404, "Chat does not exist");
  }

  // Only send messages if the logged in user is a part of the chat he is requesting messages of
  if (!selectedChat.participants?.includes(req.user?._id)) {
    throw new ApiError(400, "User is not a part of this chat");
  }

  const messages = await ChatMessage.aggregate([
    {
      $match: {
        chat: new mongoose.Types.ObjectId(chatId),
      },
    },
    ...chatMessageCommonAggregation(),
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  const userId = req.user?._id;
  // if (selectedChat.participants.length === 2) {
  //   deleteMessages(chatId, userId);
  //   // await ChatMessage.deleteMany({
  //   //   chat: new mongoose.Types.ObjectId(chatId),
  //   //   "sender._id": { $ne: userId }, // Exclude messages sent by the logged-in user
  //   // });
  // }

  // If there are more than two participants, loop through the messages and add the user's ID
  if (selectedChat.participants.length >= 3) {
    for (const message of messages) {
      // Ensure that the message is a Mongoose document
      const messageId = message._id; // Assuming _id is the identifier field
      const conditions = {
        _id: messageId,
        receivedParticipants: { $ne: userId }, // Check if userId is not already in the array
      };

      const update = {
        $push: { receivedParticipants: userId },
      };

      await ChatMessage.updateOne(conditions, update);
    }

    // After looping through the messages, check and delete messages if all participants have received them
    await checkAndDeleteMessages(chatId);
  }

  if (selectedChat.participants.length === 2) {
    deleteTextMessages(chatId, userId);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, messages || [], "Messages fetched successfully")
    );
});

const sendMessage = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { content } = req.body;

  // Update the last seen timestamp for the user sending the message
  const currentDate = new Date();
  await User.updateOne(
    { _id: req.user._id },
    { $set: { lastSeen: currentDate } }
  );

  if (!content && !req.files?.attachments?.length) {
    throw new ApiError(400, "Message content or attachment is required");
  }

  const selectedChat = await Chat.findById(chatId);

  if (!selectedChat) {
    throw new ApiError(404, "Chat does not exist");
  }

  const messageFiles = [];

  if (req.files && req.files.attachments?.length > 0) {
    req.files.attachments?.map((attachment) => {
      messageFiles.push({
        url: getStaticFilePath(req, attachment.filename),
        localPath: getLocalPath(attachment.filename),
      });
    });
  }

  // Create a new message instance with appropriate metadata
  const message = await ChatMessage.create({
    sender: new mongoose.Types.ObjectId(req.user._id),
    content: content || "",
    chat: new mongoose.Types.ObjectId(chatId),
    attachments: messageFiles,
    receivedParticipants: [req.user._id], // Include the sender in receivedParticipants
  });

  // update the chat's last message which could be utilized to show last message in the list item
  const chat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $set: {
        lastMessage: message._id,
      },
    },
    { new: true }
  );

  // structure the message
  const messages = await ChatMessage.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(message._id),
      },
    },
    ...chatMessageCommonAggregation(),
  ]);

  // Store the aggregation result
  const receivedMessage = messages[0];

  if (!receivedMessage) {
    throw new ApiError(500, "Internal server error");
  }

  // logic to emit socket event about the new message created to the other participants
  chat.participants.forEach((participantObjectId) => {
    // here the chat is the raw instance of the chat in which participants is the array of object ids of users
    // avoid emitting event to the user who is sending the message
    if (participantObjectId.toString() === req.user._id.toString()) return;

    // emit the receive message event to the other participants with received message as the payload
    emitSocketEvent(
      req,
      participantObjectId.toString(),
      ChatEventEnum.MESSAGE_RECEIVED_EVENT,
      receivedMessage
    );

    console.log(`chat sent through socket to: ${participantObjectId}`);
  });

  return res
    .status(201)
    .json(new ApiResponse(201, receivedMessage, "Message saved successfully"));
});

const deleteMessage = async (messageId) => {
  try {
    // Fetch the message
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      console.error(`Message with ID ${messageId} not found.`);
      return;
    }

    // Remove attachments from the local storage
    message.attachments.forEach((attachment) => {
      removeLocalFile(attachment.localPath);
    });

    // Delete the message
    await ChatMessage.findByIdAndDelete(messageId);

    console.log(
      `Message with ID ${messageId} deleted as all participants have received it.`
    );
  } catch (error) {
    console.error("Error deleting message:", error);
  }
};

export const checkAndDeleteMessages = async (chatId) => {
  try {
    // Fetch the chat details using the chatId from the messages
    const chat = await Chat.findById(chatId);

    if (!chat) {
      console.error(`Chat with ID ${chatId} not found.`);
      return; // Terminate the function if chat is not found
    }

    // Find all messages for the given chatId
    const messages = await ChatMessage.find({ chat: chatId });

    for (const message of messages) {
      try {
        // Check if the message has receivedParticipants property and it is an array
        if (
          !message.receivedParticipants ||
          !Array.isArray(message.receivedParticipants)
        ) {
          console.error(
            `Invalid receivedParticipants property in message ID ${message._id}.`
          );
          continue; // Move on to the next message
        }

        // Check if all participants have received the message
        const allReceived = chat.participants.every((participantId) =>
          message.receivedParticipants.includes(participantId.toString())
        );

        if (allReceived) {
          // All participants have received the message, delete the message
          await deleteMessage(message._id); // Replace deleteMessage with the actual function you use to delete messages
          console.log(
            `Message ID ${message._id} deleted as all participants have received the message.`
          );
        }
      } catch (error) {
        console.error(`Error processing message: ${error.message}`);
        // Handle the error as needed, e.g., log it, continue to the next message, or rethrow
      }
    }
  } catch (error) {
    console.error(`Error fetching messages: ${error.message}`);
    // Handle the error as needed, e.g., log it, return an error response, or rethrow
  }
};

export { getAllMessages, sendMessage };
