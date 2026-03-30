// ============================================================
// CORE DEPENDENCIES
// ============================================================
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import bodyParser from "body-parser";
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

// ============================================================
// DATABASE & INTERNAL UTILITIES
// ============================================================
import { DB_NAME } from "./Constants.js";
import { dbInstance } from "./db/index.js";
import { initializeSocketIO, initializeSocketIOT } from "./socket/socket.js";
import { ApiError } from "./utils/ApiError.js";
import { ApiResponse } from "./utils/ApiResponse.js";

// ============================================================
// FILE PATH SETUP (ESM __dirname equivalent)
// ============================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// SWAGGER DOCUMENTATION SETUP
// ============================================================
const file = fs.readFileSync(path.resolve(__dirname, "./swagger.yaml"), "utf8");
const swaggerDocument = YAML.parse(file);

// ============================================================
//  APP & HTTP SERVER INITIALIZATION
// ============================================================
const app = express();
const httpServer = createServer(app);

// ============================================================
// SOCKET.IO SETUP
// ============================================================
const io = new Server(httpServer, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
});

// Mount io instance on app (preferred over global to avoid polluting global scope)
app.set("io", io);

// ============================================================
// GLOBAL MIDDLEWARES
// ============================================================

// -- CORS: Allow requests from the specified origin
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// -- RATE LIMITER: Prevent abuse and excessive cost spikes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15-minute window
  max: 5000,                  // Max 5000 requests per window per IP
  standardHeaders: true,      // Include RateLimit-* headers in response
  legacyHeaders: false,       // Disable X-RateLimit-* legacy headers
  handler: (_, __, ___, options) => {
    throw new ApiError(
      options.statusCode || 500,
      `There are too many requests. You are only allowed ${options.max} requests per ${options.windowMs / 60000} minutes`
    );
  },
});
app.use(limiter);

// -- BODY PARSERS: Handle JSON, URL-encoded data, and static files
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public")); // Serve static files (e.g., images) from /public
// app.use(cookieParser());        // Cookie parser (disabled — uncomment if needed)
app.use(bodyParser.json());        // Parse JSON payloads

// -- SESSION & PASSPORT: Authentication support
// Note: Currently disabled — uncomment to enable persistent login sessions
// app.use(
//   session({
//     secret: process.env.EXPRESS_SESSION_SECRET,
//     resave: true,
//     saveUninitialized: true,
//   })
// );
// app.use(passport.initialize());
// app.use(passport.session()); // persistent login sessions

// ============================================================
// USER & AUTH ROUTES
// ============================================================
import userRouter from "./routes/apps/auth/user.routes.js";

// ============================================================
// CHAT APP ROUTES
// ============================================================
import chatRouter    from "./routes/apps/chat-app/chat.routes.js";
import messageRouter from "./routes/apps/chat-app/message.routes.js";

// ============================================================
//  SOCIAL MEDIA ROUTES
// ============================================================
import socialBookmarkRouter     from "./routes/apps/social-media/bookmark.routes.js";
import socialCommentRouter      from "./routes/apps/social-media/comment.routes.js";
import socialCommentReplyRouter from "./routes/apps/social-media/comment.reply.routes.js";
import socialFollowRouter       from "./routes/apps/social-media/follow.routes.js";
import socialLikeRouter         from "./routes/apps/social-media/like.routes.js";
import socialPostRouter         from "./routes/apps/social-media/post.routes.js";
import socialProfileRouter      from "./routes/apps/social-media/profile.routes.js";

// ============================================================
//  GIF ROUTES
// ============================================================
import gifRouter from "./routes/apps/gif/gif.route.js";

// ============================================================
//  FEED POST ROUTES
// ============================================================
import feedFollowedRouter     from "./routes/apps/feed/feed_followUnfollow.routes.js";
import feedRouter             from "./routes/apps/feed/feed.routes.js";
import feedLikeRouter         from "./routes/apps/feed/feed_like.routes.js";
import feedCommentRouter      from "./routes/apps/feed/feed_comment.routes.js";
import feedCommentReplyRouter from "./routes/apps/feed/feed_comment.reply.routes.js";
import feedBookmarkRouter     from "./routes/apps/feed/feed_bookmark.routes.js";

// ============================================================
//  ROUTE MOUNTING
// ============================================================

// -- User & Auth
app.use("/api/v1/users", userRouter);

// -- Chat App
app.use("/api/v1/chat-app/chats",    chatRouter);
app.use("/api/v1/chat-app/messages", messageRouter);

// -- Social Media
app.use("/api/v1/social-media/profile",       socialProfileRouter);
app.use("/api/v1/social-media/follow",        socialFollowRouter);
app.use("/api/v1/social-media/posts",         socialPostRouter);
app.use("/api/v1/social-media/likes",         socialLikeRouter);
app.use("/api/v1/social-media/bookmarks",     socialBookmarkRouter);
app.use("/api/v1/social-media/comments",      socialCommentRouter);
app.use("/api/v1/social-media/comment/reply", socialCommentReplyRouter);

// -- GIF
app.use("/api/v1/gif", gifRouter);

// -- Feed Posts
app.use("/api/v1/feed/followed",       feedFollowedRouter);
app.use("/api/v1/feed/post",           feedRouter);
app.use("/api/v1/feed/like",           feedLikeRouter);
app.use("/api/v1/feed/comments",       feedCommentRouter);
app.use("/api/v1/feed/comment/reply",  feedCommentReplyRouter);
app.use("/api/v1/feed/bookmarks",      feedBookmarkRouter);

// ============================================================
//  SOCKET.IO INITIALIZATION
// ============================================================
// initializeSocketIO(io); // Alternative socket initializer (commented out)
initializeSocketIOT(io);

// ============================================================
//  API DOCUMENTATION — Swagger UI (mounted on "/" root)
// Note: Kept at the end so it doesn't intercept other routes
// ============================================================
app.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    swaggerOptions: {
      docExpansion: "none", // Keep all sections collapsed by default
    },
    customSiteTitle: "FreeAPI docs",
  })
);

export { httpServer };