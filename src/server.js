import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import session from "express-session";
import fs from "fs";
import { createServer } from "http";
import passport from "passport";
import path from "path";
import { Server } from "socket.io";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import YAML from "yaml";
import { DB_NAME } from "./constants.js";
import { dbInstance } from "./db/index.js";
import { initializeSocketIO, initializeSocketIOT } from "./socket/socket.js";
import { ApiError } from "./utils/ApiError.js";
import { ApiResponse } from "./utils/ApiResponse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = fs.readFileSync(path.resolve(__dirname, "./swagger.yaml"), "utf8");
const swaggerDocument = YAML.parse(file);

const app = express();

const httpServer = createServer(app);
import bodyParser from "body-parser";
const io = new Server(httpServer, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
});

app.set("io", io); // using set method to mount the `io` instance on the app to avoid usage of `global`

// global middlewares
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// Rate limiter to avoid misuse of the service and avoid cost spikes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (_, __, ___, options) => {
    throw new ApiError(
      options.statusCode || 500,
      `There are too many requests. You are only allowed ${options.max
      } requests per ${options.windowMs / 60000} minutes`
    );
  },
});

// Apply the rate limiting middleware to all requests
app.use(limiter);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public")); // configure static file to save images locally
// app.use(cookieParser());
app.use(bodyParser.json()); // For JSON payloads

// // required for passport
// app.use(
//   session({
//     secret: process.env.EXPRESS_SESSION_SECRET,
//     resave: true,
//     saveUninitialized: true,
//   })
// ); // session secret
// app.use(passport.initialize());
// app.use(passport.session()); // persistent login sessions

// * App routes
import userRouter from "./routes/apps/auth/user.routes.js";

import chatRouter from "./routes/apps/chat-app/chat.routes.js";
import messageRouter from "./routes/apps/chat-app/message.routes.js";

import socialBookmarkRouter from "./routes/apps/social-media/bookmark.routes.js";
import socialCommentRouter from "./routes/apps/social-media/comment.routes.js";
import socialCommentReplyRouter from "./routes/apps/social-media/comment.reply.routes.js";
import socialFollowRouter from "./routes/apps/social-media/follow.routes.js";
import socialLikeRouter from "./routes/apps/social-media/like.routes.js";
import socialPostRouter from "./routes/apps/social-media/post.routes.js";
import socialProfileRouter from "./routes/apps/social-media/profile.routes.js";
import gifRouter from "./routes/apps/gif/gif.route.js";

import feedFollowedRouter from "./routes/apps/feed/feed_followUnfollow.routes.js"
import feedRouter from "./routes/apps/feed/feed.routes.js";
import feedLikeRouter from "./routes/apps/feed/feed_like.routes.js";
import feedCommentRouter from "./routes/apps/feed/feed_comment.routes.js";
import feedCommentReplyRouter from "./routes/apps/feed/feed_comment.reply.routes.js";
import feedBookmarkRouter from "./routes/apps/feed/feed_bookmark.routes.js";

// * App apis
app.use("/api/v1/users", userRouter);
app.use("/api/v1/chat-app/chats", chatRouter);
app.use("/api/v1/chat-app/messages", messageRouter);

app.use("/api/v1/social-media/profile", socialProfileRouter);
app.use("/api/v1/social-media/follow", socialFollowRouter);
app.use("/api/v1/social-media/posts", socialPostRouter);
app.use("/api/v1/social-media/likes", socialLikeRouter);
app.use("/api/v1/social-media/bookmarks", socialBookmarkRouter);
app.use("/api/v1/social-media/comments", socialCommentRouter);
app.use("/api/v1/social-media/comment/reply", socialCommentReplyRouter);

app.use("/api/v1/gif", gifRouter);
app.use("/api/v1/feed/followed", feedFollowedRouter);
app.use("/api/v1/feed/post", feedRouter);
app.use("/api/v1/feed/like", feedLikeRouter);
app.use("/api/v1/feed/comments", feedCommentRouter);
app.use("/api/v1/feed/comment/reply", feedCommentReplyRouter);
app.use("/api/v1/feed/bookmarks", feedBookmarkRouter);
initializeSocketIOT(io);
// * API DOCS
// ? Keeping swagger code at the end so that we can load swagger on "/" route
app.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    swaggerOptions: {
      docExpansion: "none", // keep all the sections collapsed by default
    },
    customSiteTitle: "FreeAPI docs",
  })
);

export { httpServer };
