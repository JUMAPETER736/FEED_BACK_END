import { ChatMessage } from "../models/apps/chat-app/message.models";
import { Chat } from "../models/apps/chat-app/chat.models";
import { removeLocalFile } from "./Helpers";

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
