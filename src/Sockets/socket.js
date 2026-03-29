import cookie from "cookie";
import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { AvailableChatEvents, ChatEventEnum, NotificationEventEnum, } from "../constants.js";
import { User } from "../models/apps/auth/user.models.js";
import { ApiError } from "../Utils/API_Errors.js";
import { removeLocalFile } from "../utils/helpers.js";
import { ChatMessage } from "../models/apps/chat-app/message.models.js";
import { BusinessNotification } from "../models/apps/business/businesspost/notification/business.notification.model.js";
import UnifiedNotification from "../models/apps/notifications/unified.notification.model.js";

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

/**
 * @description This function is responsible to allow user to join the chat represented by chatId (chatId). event happens when user switches between the chats
 * @param {Socket<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} socket
 */
const mountJoinChatEvent = (socket) => {
  socket.on(ChatEventEnum.JOIN_CHAT_EVENT, (chatId) => {
    console.log(`User joined the chat . chatId: `, chatId);
    // joining the room with the chatId will allow specific events to be fired where we don't bother about the users like typing events
    // E.g. When user types we don't want to emit that event to specific participant.
    // We want to just emit that to the chat where the typing is happening
    socket.join(chatId);
  });
};

/**
 * @description This function is responsible to emit the typing event to the other participants of the chat
 * @param {Socket<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} socket
 */
const mountParticipantTypingEvent = (socket) => {
  socket.on(ChatEventEnum.TYPING_EVENT, (chatId) => {
    socket.in(chatId).emit(ChatEventEnum.TYPING_EVENT, chatId);
  });
};

/**
 * @description This function is responsible to emit the stopped typing event to the other participants of the chat
 * @param {Socket<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} socket
 */
const mountParticipantStoppedTypingEvent = (socket) => {
  socket.on(ChatEventEnum.STOP_TYPING_EVENT, (chatId) => {
    socket.in(chatId).emit(ChatEventEnum.STOP_TYPING_EVENT, chatId);
  });
};

/**
 * @description This function is responsible to emit the message delivered event to the message sender after other participants of the chat received the message
 * @param {Socket<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} socket
 */
const mountMessageDeliveryEvent = (socket) => {
  socket.on("messageDelivered", (delivery) => {
    const { roomId, sender } = delivery;

    // Emit the message delivered event only to the sender
    socket.to(sender).emit(ChatEventEnum.MESSAGE_DELIVERED_EVENT, roomId);
  });
};

/**
 * @description This function is responsible to emit the message seen event to the message sender after other participants of the chat opens the message
 * @param {Socket<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} socket
 */
const mountMessageSeenEvent = (socket) => {
  socket.on("messageSeen", (seenReport) => {
    const { roomId, sender } = seenReport;

    // Emit the message delivered event only to the sender
    socket.to(sender).emit(ChatEventEnum.MESSAGE_SEEN_EVENT, roomId);
  });
};

const mountDownloadedEvent = (socket) => {
  socket.on(ChatEventEnum.ATTACHMENT_DOWNLOADED_EVENT, async (downloaded) => {
    try {
      const { messageId, userId } = downloaded;

      // Find the message in the database and populate the 'chat' field
      const message = await ChatMessage.findById(messageId).populate("chat");

      if (!message) {
        console.error(`Message with ID ${messageId} not found.`);
        return;
      }

      // Check if the user is a participant in the chat
      const isParticipant = message.chat.participants.some(
        (participantId) => participantId.toString() === userId.toString()
      );

      if (!isParticipant) {
        console.error(
          `User with ID ${userId} is not a participant in the chat.`
        );
        return;
      }

      // Update the receivedParticipants array if the user is a participant
      if (!message.receivedParticipants.includes(userId)) {
        message.receivedParticipants.push(userId);
        await message.save();
      }

      console.log(
        `Attachments for message ID ${messageId} downloaded by user ID ${userId}`
      );

      // Check if all participants have received the message
      const allReceived = message.chat.participants.every((participantId) =>
        message.receivedParticipants.includes(participantId.toString())
      );

      if (allReceived && message.attachments.length === 0) {
        // All participants have received the message, you can perform further actions here
        // For example, you may choose to delete the message from MongoDB
        await deleteMessage(messageId);
        console.log(
          `Message-Attachments ID ${messageId} deleted as all participants have received the message.`
        );
      }
    } catch (error) {
      console.error("Error handling download acknowledgment:", error);
    }
  });
};

const mountAcknowledgmentEvent = (socket) => {
  socket.on(ChatEventEnum.ACKNOWLEDGE_MESSAGE_EVENT, async (acknowledgment) => {
    try {
      const { messageId, userId } = acknowledgment;

      // Find the message in the database and populate the 'chat' field
      const message = await ChatMessage.findById(messageId).populate("chat");

      if (!message) {
        console.error(`Message with ID ${messageId} not found.`);
        return;
      }

      // Check if the user is a participant in the chat
      const isParticipant = message.chat.participants.some(
        (participantId) => participantId.toString() === userId.toString()
      );

      if (!isParticipant) {
        console.error(
          `User with ID ${userId} is not a participant in the chat.`
        );
        return;
      }

      // Update the receivedParticipants array if the user is a participant
      if (!message.receivedParticipants.includes(userId)) {
        message.receivedParticipants.push(userId);
        await message.save();
      }

      console.log(
        `Acknowledgment received for message ID ${messageId} from user ID ${userId}`
      );

      // Check if all participants have received the message
      const allReceived = message.chat.participants.every((participantId) =>
        message.receivedParticipants.includes(participantId.toString())
      );

      if (allReceived && message.attachments.length === 0) {
        // All participants have received the message, you can perform further actions here
        // For example, you may choose to delete the message from MongoDB
        await deleteMessage(messageId);
        console.log(
          `Message ID ${messageId} deleted as all participants have received the message.`
        );
      }
    } catch (error) {
      console.error("Error handling acknowledgment:", error);
    }
  });
};

const activeConnections = new Map();
const userIdToSocketMap = new Map();

const activeUsers = [];


/**
 * @description This function sends the initial unread count when user connects
 * @param {Socket} socket
 */
const sendInitialUnreadCount = async (socket) => {
  try {
    const userId = socket.user._id;
    const businessUnreadCount = await BusinessNotification.countDocuments({
      owner: userId,
      read: false
    });

    const feedUnreadCount = await UnifiedNotification.countDocuments({
      owner: userId,
      read: false
    });


    const totalUnreadCount = businessUnreadCount + feedUnreadCount;

    socket.emit(NotificationEventEnum.UNREAD_COUNT_UPDATE, { totalUnreadCount, businessUnreadCount, feedUnreadCount });
    console.log(`Sent initial unread count to user ${userId}:\ntotal: ${totalUnreadCount}\nbusiness: ${businessUnreadCount}\nfeed: ${feedUnreadCount}`);
  } catch (error) {
    console.error("Error sending initial unread count:", error);
  }
};

/**
 * @description Mount notification request event - client can request unread count
 * @param {Socket} socket
 */
const mountRequestUnreadCountEvent = (socket) => {
  socket.on("requestUnreadCount", async () => {
    await sendInitialUnreadCount(socket);
  });
};



/**
 *
 * @param {Server<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} io
 */
const initializeSocketIO = (io) => {
  return io.on("connection", async (socket) => {
    try {
      // parse the cookies from the handshake headers (This is only possible if client has `withCredentials: true`)
      const cookies = cookie.parse(socket.handshake.headers?.cookie || "");

      let token = cookies?.accessToken; // get the accessToken

      if (!token) {
        // If there is no access token in cookies. Check inside the handshake auth
        token = socket.handshake.auth?.token;
      }

      if (!token) {
        // Token is required for the socket to work
        throw new ApiError(401, "Un-authorized handshake. Token is missing");
      }

      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET); // decode the token

      const user = await User.findById(decodedToken?._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
      );

      // retrieve the user
      if (!user) {
        throw new ApiError(401, "Un-authorized handshake. Token is invalid");
      }
      socket.user = user; // mount te user object to the socket

      // We are creating a room with user id so that if user is joined but does not have any active chat going on.
      // still we want to emit some socket events to the user.
      // so that the client can catch the event and show the notifications.
      socket.join(user._id.toString());
      socket.emit(ChatEventEnum.CONNECTED_EVENT); // emit the connected event so that client is aware
      console.log("User connected . userId: socket.js", user._id.toString());

      // Common events that needs to be mounted on the initialization
      mountJoinChatEvent(socket);
      mountParticipantTypingEvent(socket);
      mountParticipantStoppedTypingEvent(socket);

      socket.on(ChatEventEnum.DISCONNECT_EVENT, () => {
        console.log("user has disconnected . userId: " + socket.user?._id);
        if (socket.user?._id) {
          socket.leave(socket.user._id);
        }
      });
    } catch (error) {
      socket.emit(
        ChatEventEnum.SOCKET_ERROR_EVENT,
        error?.message || "Something went wrong while connecting to the socket."
      );
    }
  });
};

/**
 * @description This function is responsible for updating the last seen timestamp and emitting the connected event.
 * @param {Socket<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} socket
 */
const handleUserConnection = async (socket) => {
  try {
    // Retrieve the user information from the token
    const token = socket.handshake.query.token;

    if (!token) {
      throw new ApiError(401, "Un-authorized handshake. Token is missing");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
    );

    if (!user) {
      throw new ApiError(401, "Un-authorized handshake. Token is invalid");
    }

    // Update the last seen timestamp
    user.lastSeen = new Date();
    await user.save();

    // Set user information on the socket
    socket.user = user;

    // Store the socket in the activeConnections map
    //activeConnections.set(user._id.toString(), user);

    // Store the socket in the activeConnections map using socket.id as the key
    activeConnections.set(socket.id, socket);
    userIdToSocketMap.set(user._id.toString(), socket.id);

    activeUsers.push(user._id.toString());

    // Join the room with user id
    socket.join(user._id.toString());

    // // Emit the connected event
    // socket.emit(ChatEventEnum.CONNECTED_EVENT);

    // Emit the connected event along with the last seen information
    socket.emit(ChatEventEnum.CONNECTED_EVENT, { lastSeen: user.lastSeen });

    console.log("User connected . userId socket.js: ", user._id.toString());

    console.log("Connected Users . size: ", activeConnections.size);

    // Common events that need to be mounted on initialization
    mountJoinChatEvent(socket);
    mountParticipantTypingEvent(socket);
    mountParticipantStoppedTypingEvent(socket);
    mountMessageDeliveryEvent(socket);
    mountMessageSeenEvent(socket);
    mountAcknowledgmentEvent(socket);
    mountDownloadedEvent(socket);
    mountRequestUnreadCountEvent(socket);

    // Handle disconnect event
    socket.on(ChatEventEnum.DISCONNECT_EVENT, async () => {
      console.log("User has disconnected . userId: " + socket.user?._id);
      // Remove the socket from activeConnections map
      // activeConnections.delete(socket.user?._id);

      handleUserDisconnects(socket);

      // Log the socket ID before removal
      console.log("Socket ID before removal: ", socket.id);


      if (socket.user?._id) {
        socket.leave(socket.user._id);
      }

      console.log("Connected Users . size: ", activeConnections.size);
      // Update the last seen timestamp before disconnecting
      socket.user.lastSeen = new Date();
      await socket.user.save();

      if (socket.user?._id) {
        socket.leave(socket.user._id);
      }

      const disconnectedUserId = userIdToSocketMap.get(socket.user._id);

      // const userRemoved = userIdToSocketMap.delete(disconnectedUserId);

      const userRemoved = userIdToSocketMap.delete(socket.user._id);

      // Remove the socket from activeConnections map using socket.id
      const removed = activeConnections.delete(socket.id);

      if (removed) {
        console.log("User removed from active connections map");
      } else {
        console.log("User not found in active connections map");
      }

      if (userRemoved) {
        console.log("User removed from active user socket map");
      } else {
        console.log("User not found in active user socket map");
      }

      // Broadcast last seen information to chat rooms
      socket.rooms.forEach((room) => {
        socket.in(room).emit(ChatEventEnum.LAST_SEEN_EVENT, {
          userId: socket.user?._id,
          lastSeen: socket.user?.lastSeen,
        });
      });
    });

    // When you want to check if a user is connected
    function isUserConnected(userId) {
      return userIdToSocketMap.has(userId);
    }


  } catch (error) {
    socket.emit(
      ChatEventEnum.SOCKET_ERROR_EVENT,
      error?.message || "Something went wrong while connecting to the socket."
    );
  }
};

const handleUserConnections = async (socket) => {
  try {
    const token = socket.handshake.query.token;

    if (!token) {
      throw new ApiError(401, "Un-authorized handshake. Token is missing");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
    );

    if (!user) {
      throw new ApiError(401, "Un-authorized handshake. Token is invalid");
    }

    user.lastSeen = new Date();
    await user.save();

    socket.user = user;

    activeConnections.set(user._id.toString(), socket);

    socket.join(user._id.toString());

    socket.once(ChatEventEnum.CONNECTED_EVENT, ({ lastSeen }) => {
      console.log("User connected . userId: ", user._id.toString());
      console.log("Connected Users . size: ", activeConnections.size);

      // Common events that need to be mounted on initialization
      mountJoinChatEvent(socket);
      mountParticipantTypingEvent(socket);
      mountParticipantStoppedTypingEvent(socket);

      // Handle disconnect event
      socket.on(ChatEventEnum.DISCONNECT_EVENT, async () => {
        activeConnections.delete(socket.user?._id);

        console.log("User has disconnected . userId: " + socket.user?._id);

        console.log("Connected Users . size: ", activeConnections.size);

        socket.user.lastSeen = new Date();
        await socket.user.save();

        if (socket.user?._id) {
          socket.leave(socket.user._id);
        }

        socket.rooms.forEach((room) => {
          socket.in(room).emit(ChatEventEnum.LAST_SEEN_EVENT, {
            userId: socket.user?._id,
            lastSeen: socket.user?.lastSeen,
          });
        });
      });
    });

    // Emit the connected event along with the last seen information
    socket.emit(ChatEventEnum.CONNECTED_EVENT, { lastSeen: user.lastSeen });
  } catch (error) {
    socket.emit(
      ChatEventEnum.SOCKET_ERROR_EVENT,
      error?.message || "Something went wrong while connecting to the socket."
    );
  }
};

// Helper function to get a socket by user ID
const getSocketByUserId = (userId) => {
  return activeConnections.get(userId);
};

// When you want to check if a user is connected
function isUserConnected(userId) {
  return userIdToSocketMap.has(userId);
}

/**
 *
 * @param {Server<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} io
 */

const initializeSocketIOT = (io) => {
  return io.on("connection", async (socket) => {
    try {
      const token = socket.handshake.query.token; // Get the token from query parameters

      if (!token) {
        throw new ApiError(401, "Un-authorized handshake. Token is missing");
      }

      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      const user = await User.findById(decodedToken?._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
      );

      if (!user) {
        throw new ApiError(401, "Un-authorized handshake. Token is invalid");
      }

      // Update the last seen timestamp
      user.lastSeen = new Date();
      await user.save();

      socket.user = user;

      // We are creating a room with user id so that if user is joined but does not have any active chat going on.
      // still we want to emit some socket events to the user.
      // so that the client can catch the event and show the notifications.
      socket.join(user._id.toString());
      socket.emit(ChatEventEnum.CONNECTED_EVENT); // emit the connected event so that client is aware
      console.log("User connected . userId: ", user._id.toString());

      // Common events that needs to be mounted on the initialization
      mountJoinChatEvent(socket);
      mountParticipantTypingEvent(socket);
      mountParticipantStoppedTypingEvent(socket);

      socket.on(ChatEventEnum.MESSAGE_SENT_EVENT, () => {
        console.log("user has disconnected . userId: " + socket.user?._id);
        if (socket.user?._id) {
          socket.leave(socket.user._id);
        }
      });

      socket.on(ChatEventEnum.DISCONNECT_EVENT, () => {
        console.log(
          "user has disconnected From Device. userId: " + socket.user?._id
        );
        if (socket.user?._id) {
          socket.leave(socket.user._id);
        }
      });
    } catch (error) {
      socket.emit(
        ChatEventEnum.SOCKET_ERROR_EVENT,
        error?.message || "Something went wrong while connecting to the socket."
      );
    }
  });
};

/**
 *
 * @param {Server<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} io
 */
const initializeSocket = (io) => {
  return io.on("connection", handleUserConnection);
};

/**
 *
 * @param {import("express").Request} req - Request object to access the `io` instance set at the entry point
 * @param {string} roomId - Room where the event should be emitted
 * @param {AvailableChatEvents[0]} event - Event that should be emitted
 * @param {any} payload - Data that should be sent when emitting the event
 * @description Utility function responsible to abstract the logic of socket emission via the io instance
 */
const emitSocketEvent = (req, roomId, event, payload) => {
  console.log(`Event: ${event} \nPayload: ${payload} \nRoomID: ${roomId}`);
  req.app.get("io").in(roomId).emit(event, payload);
};

// When a user disconnects
function handleUserDisconnect(socket) {
  const disconnectedUserId = activeConnections.get(socket.id);

  console.log(`Disconnected User ID: ${disconnectedUserId}`);

  // Remove the socket from activeConnections map using socket.id
  const removedFromActiveConnections = activeConnections.delete(socket.id);

  // Convert the user ID to string
  const disconnectedUserIdString = disconnectedUserId.toString();

  // Remove the user from userIdToSocketMap using user ID
  const removedFromUserIdMap = userIdToSocketMap.delete(
    disconnectedUserIdString
  );

  if (removedFromActiveConnections) {
    console.log("User removed from active connections map");
  } else {
    console.log("User not found in active connections map");
  }

  if (removedFromUserIdMap) {
    console.log("User removed from active user socket map");
  } else {
    console.log("User not found in active user socket map");
  }
}

function handleUserDisconnects(socket) {
  const disconnectedUserId = socket.user._id.toString();

  // Check if the user ID is in the activeUsers array
  const userIndex = activeUsers.indexOf(disconnectedUserId);

  if (userIndex === -1) {
    console.log("User not found in active users array");
    return;
  }

  console.log(`Disconnected User ID: ${disconnectedUserId}`);

  // Remove the user ID from the activeUsers array
  activeUsers.splice(userIndex, 1);

  console.log("User removed from active users array");
}

function isUserActive(userId) {
  return activeUsers.includes(userId);
}

/**
 * @description Function to emit unread count update to a specific user
 * @param {import("express").Request} req - Request object to access the `io` instance
 * @param {string} userId - User ID to whom the unread count should be sent
 */
const emitUnreadCountUpdate = async (req, userId) => {
  try {
    const businessUnreadCount = await BusinessNotification.countDocuments({
      owner: userId,
      read: false
    });

    const feedUnreadCount = await UnifiedNotification.countDocuments({
      owner: userId,
      read: false
    });

    const totalUnreadCount = businessUnreadCount + feedUnreadCount;

    const io = req.app.get("io");
    io.in(userId.toString()).emit(NotificationEventEnum.UNREAD_COUNT_UPDATE, { totalUnreadCount, businessUnreadCount, feedUnreadCount });
    console.log(`Emitted unread count update to user ${userId}:\n total: ${totalUnreadCount}\n business: ${businessUnreadCount}\n feed: ${feedUnreadCount}`);
  } catch (error) {
    console.error("Error emitting unread count:", error);
  }
};

// Usage example:
// Call handleUserDisconnect(socket) when a user disconnects

export {
  initializeSocketIO,
  emitSocketEvent,
  initializeSocketIOT,
  initializeSocket,
  activeConnections,
  isUserConnected,
  isUserActive,
  getSocketByUserId,
  emitUnreadCountUpdate
};
