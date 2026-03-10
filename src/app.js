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
import { DB_NAME } from "./constants.js";
import { dbInstance } from "./db/index.js";
import {
  initializeSocketIO,
  initializeSocket,
  initializeSocketIOT,
} from "./socket/socket.js";
import { ApiError } from "./utils/ApiError.js";
import { ApiResponse } from "./utils/ApiResponse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = fs.readFileSync(path.resolve(__dirname, "./swagger.yaml"), "utf8");
const swaggerDocument = YAML.parse(file);

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
});

// Store the io instance globally
global.io = io;

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
app.use(cookieParser());
app.use(bodyParser.json()); // For JSON payloads

// required for passport
app.use(
  session({
    secret: process.env.EXPRESS_SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
  })
); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

// api routes
import { errorHandler } from "./middlewares/error.middlewares.js";
import healthcheckRouter from "./routes/healthcheck.routes.js";

// * Public routes
import bookRouter from "./routes/public/book.routes.js";
import catRouter from "./routes/public/cat.routes.js";
import dogRouter from "./routes/public/dog.routes.js";
import mealRouter from "./routes/public/meal.routes.js";
import quoteRouter from "./routes/public/quote.routes.js";
import randomjokeRouter from "./routes/public/randomjoke.routes.js";
import randomproductRouter from "./routes/public/randomproduct.routes.js";
import randomuserRouter from "./routes/public/randomuser.routes.js";
import youtubeRouter from "./routes/public/youtube.routes.js";

// * App routes
import userRouter from "./routes/apps/auth/user.routes.js";
// const userRoutes = require("./routes/userRoutes")
// import userRouter from "./routes/userRoutes.js"
import userRoutes from "./routes/userRoutes.js";
import userLocationRouter from "./routes/location/user.location.route.js"

import businessRouter from "./routes/apps/business/profile.routes.js";
import catalogueRouter from "./routes/apps/business/catalogue.routes.js";
import businessPostRouter from "./routes/apps/business/business.post.routes.js";
import businessPostLikesRouter from "./routes/apps/business/businesspost/business.post.like.routes.js";
import businessPostCommentsRouter from "./routes/apps/business/businesspost/business.post.comment.routes.js";
import businessPostCommentReplyRouter from "./routes/apps/business/businesspost/business.post.comment.reply.routes.js";
import businessPostBookmarkRouter from "./routes/apps/business/businesspost/business.post.bookmark.routes.js";
import businessNotificationRouter from "./routes/apps/notifications/business.notification.routes.js";
//gif router
import gifRouter from "./routes/apps/gif/gif.route.js";

import notificationRouter from "./routes/apps/notifications/notification.routes.js";

// notifiCATIONS

import addressRouter from "./routes/apps/ecommerce/address.routes.js";
import cartRouter from "./routes/apps/ecommerce/cart.routes.js";
import categoryRouter from "./routes/apps/ecommerce/category.routes.js";
import couponRouter from "./routes/apps/ecommerce/coupon.routes.js";
import orderRouter from "./routes/apps/ecommerce/order.routes.js";
import productRouter from "./routes/apps/ecommerce/product.routes.js";
import ecomProfileRouter from "./routes/apps/ecommerce/profile.routes.js";


// For the  Shorts
import socialBlockRouter from "./routes/apps/social-media/block.routes.js";
import socialBookmarkRouter from "./routes/apps/social-media/bookmark.routes.js";
import socialCommentRouter from "./routes/apps/social-media/comment.routes.js";
import socialCommentReplyRouter from "./routes/apps/social-media/comment.reply.routes.js";
import socialFollowRouter from "./routes/apps/social-media/follow.routes.js";
import socialLikeRouter from "./routes/apps/social-media/like.routes.js";
import socialPostRouter from "./routes/apps/social-media/post.routes.js";
import socialProfileRouter from "./routes/apps/social-media/profile.routes.js";
import userFollowingShowMoreOptionsRouter from "./routes/apps/social-media/userFollowingShowMoreOptions.routes.js";
import socialRepostRouter from "./routes/apps/social-media/repost.routes.js";
import socialShareRouter from "./routes/apps/social-media/share.routes.js";

// for logging user events to recommendation system
import recomendationEventsRouter  from "./routes/apps/events/events.routes.js";


// For the Feed Post
import feedRouter from "./routes/apps/feed/feed.routes.js";
import feedLikeRouter from "./routes/apps/feed/feed_like.routes.js";
import feedCommentRouter from "./routes/apps/feed/feed_comment.routes.js";
import feedCommentReplyRouter from "./routes/apps/feed/feed_comment.reply.routes.js";
import feedBookmarkRouter from "./routes/apps/feed/feed_bookmark.routes.js";
import feedRepostRouter from "./routes/apps/feed/feed_repost.routes.js";
import feedShareRouter from "./routes/apps/feed/feed_share.routes.js";
import feedFollowedRouter from "./routes/apps/feed/feed_followUnfollow.routes.js";


import chatRouter from "./routes/apps/chat-app/chat.routes.js";
import messageRouter from "./routes/apps/chat-app/message.routes.js";

import todoRouter from "./routes/apps/todo/todo.routes.js";

// * Kitchen sink routes
import cookieRouter from "./routes/kitchen-sink/cookie.routes.js";
import httpmethodRouter from "./routes/kitchen-sink/httpmethod.routes.js";
import imageRouter from "./routes/kitchen-sink/image.routes.js";
import redirectRouter from "./routes/kitchen-sink/redirect.routes.js";
import requestinspectionRouter from "./routes/kitchen-sink/requestinspection.routes.js";
import responseinspectionRouter from "./routes/kitchen-sink/responseinspection.routes.js";
import statuscodeRouter from "./routes/kitchen-sink/statuscode.routes.js";

// * Seeding handlers
import { seedChatApp } from "./seeds/chat-app.seeds.js";
import { seedEcommerce } from "./seeds/ecommerce.seeds.js";
import { seedSocialMedia } from "./seeds/social-media.seeds.js";
import { seedTodos } from "./seeds/todo.seeds.js";
import { getGeneratedCredentials, seedUsers } from "./seeds/user.seeds.js";

// * healthcheck
app.use("/api/v1/healthcheck", healthcheckRouter);

// * Public apis
// TODO: More functionality specific to the type of api, can be added in the future
app.use("/api/v1/public/randomusers", randomuserRouter);
app.use("/api/v1/public/randomproducts", randomproductRouter);
app.use("/api/v1/public/randomjokes", randomjokeRouter);
app.use("/api/v1/public/books", bookRouter);
app.use("/api/v1/public/quotes", quoteRouter);
app.use("/api/v1/public/meals", mealRouter);
app.use("/api/v1/public/dogs", dogRouter);
app.use("/api/v1/public/cats", catRouter);
app.use("/api/v1/public/youtube", youtubeRouter);
// * App apis
app.use("/api/v1/users", userRouter);
app.use("/users", userRoutes);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/business/profile", businessRouter);
app.use("/api/v1/business/catalogue", catalogueRouter);
app.use("/api/v1/business/product-posts", businessPostRouter);
app.use("/api/v1/business/product-posts/likes", businessPostLikesRouter);
app.use("/api/v1/business/product-posts/comments", businessPostCommentsRouter);
app.use("/api/v1/business/product-posts/comments/replies", businessPostCommentReplyRouter);
app.use("/api/v1/business/products-posts/bookmarks", businessPostBookmarkRouter);
app.use("/api/v1/business/notifications", businessNotificationRouter);
app.use("/api/v1/gif", gifRouter);

// For the Feed Post
app.use("/api/v1/feed/followed", feedFollowedRouter);
app.use("/api/v1/feed/post", feedRouter);
app.use("/api/v1/feed/likes", feedLikeRouter);
app.use("/api/v1/feed/comments", feedCommentRouter);
app.use("/api/v1/feed/comment/reply", feedCommentReplyRouter);
app.use("/api/v1/feed/bookmarks", feedBookmarkRouter);
app.use("/api/v1/feed/repost", feedRepostRouter);
app.use("/api/v1/feed/share", feedShareRouter);

app.use("/api/v1/ecommerce/categories", categoryRouter);
app.use("/api/v1/ecommerce/addresses", addressRouter);
app.use("/api/v1/ecommerce/productSs", productRouter);
app.use("/api/v1/ecommerce/profile", ecomProfileRouter);
app.use("/api/v1/ecommerce/cart", cartRouter);
app.use("/api/v1/ecommerce/orders", orderRouter);
app.use("/api/v1/ecommerce/coupons", couponRouter);

app.use("/api/v1/social-media/block", socialBlockRouter);
app.use("/api/v1/social-media/profile", socialProfileRouter);
app.use("/api/v1/social-media/follow", socialFollowRouter);
app.use("/api/v1/social-media/posts", socialPostRouter);
app.use("/api/v1/social-media/likes", socialLikeRouter);
app.use("/api/v1/social-media/bookmarks", socialBookmarkRouter);
app.use("/api/v1/social-media/comments", socialCommentRouter);
app.use("/api/v1/social-media/comment/reply", socialCommentReplyRouter);
app.use("/api/v1/social-media/profile", userFollowingShowMoreOptionsRouter);
app.use("/api/v1/social-media/reposts",   socialRepostRouter);
app.use("/api/v1/social-media/shares",    socialShareRouter);


app.use("/api/v1/chat-app/chats", chatRouter);
app.use("/api/v1/chat-app/messages", messageRouter);

app.use("/api/v1/todos", todoRouter);

// * Kitchen sink apis
app.use("/api/v1/kitchen-sink/http-methods", httpmethodRouter);
app.use("/api/v1/kitchen-sink/status-codes", statuscodeRouter);
app.use("/api/v1/kitchen-sink/request", requestinspectionRouter);
app.use("/api/v1/kitchen-sink/response", responseinspectionRouter);
app.use("/api/v1/kitchen-sink/cookies", cookieRouter);
app.use("/api/v1/kitchen-sink/redirect", redirectRouter);
app.use("/api/v1/kitchen-sink/image", imageRouter);

// * Seeding
app.get("/api/v1/seed/generated-credentials", getGeneratedCredentials);
app.post("/api/v1/seed/todos", seedTodos);
app.post("/api/v1/seed/ecommerce", seedUsers, seedEcommerce);
app.post("/api/v1/seed/social-media", seedUsers, seedSocialMedia);
app.post("/api/v1/seed/chat-app", seedUsers, seedChatApp);

//user location routes
app.use("/api/v1/userlocation", userLocationRouter);

app.use("/api/v1/recommendations/events", recomendationEventsRouter);



// initializeSocketIO(io);
initializeSocket(io);
// initializeSocketIOT(io);

// ! 🚫 Danger Zone
app.delete("/api/v1/reset-db", async (req, res) => {
  if (dbInstance) {
    // Drop the whole DB
    await dbInstance.connection.db.dropDatabase({
      dbName: DB_NAME,
    });

    const directory = "./public/images";

    // Remove all product images from the file system
    fs.readdir(directory, (err, files) => {
      if (err) {
        // fail silently
        console.log("Error while removing the images: ", err);
      } else {
        for (const file of files) {
          if (file === ".gitkeep") continue;
          fs.unlink(path.join(directory, file), (err) => {
            if (err) throw err;
          });
        }
      }
    });
    // remove the seeded users if exist
    fs.unlink("./public/temp/seed-credentials.json", (err) => {
      // fail silently
      if (err) console.log("Seed credentials are missing.");
    });
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Database dropped successfully"));
  }
  throw new ApiError(500, "Something went wrong while dropping the database");
});


app.delete("/api/v1/reset-feedposts", async (req, res) => {
  if (dbInstance) {
    try {
      // Drop the 'feedposts' collection using mongoose
      await dbInstance.connection.dropCollection('feedposts');

      // Optionally, remove associated files (if needed)
      const directory = "./public/images";
      fs.readdir(directory, (err, files) => {
        if (err) {
          console.log("Error while removing the images: ", err);
        } else {
          files.forEach((file) => {
            if (file !== ".gitkeep") {
              fs.unlink(path.join(directory, file), (err) => {
                if (err) throw err;
              });
            }
          });
        }
      });

      // Clean up any other relevant files related to feedposts
      fs.unlink("./public/temp/feedpost-seed-credentials.json", (err) => {
        if (err) console.log("Feedpost seed credentials are missing.");
      });

      return res.status(200).json(new ApiResponse(200, null, "Feedposts table dropped successfully"));
    } catch (error) {
      console.error("Error dropping the feedposts table: ", error);
      return res.status(500).json(new ApiError(500, "Something went wrong while dropping the feedposts table"));
    }
  }
  return res.status(500).json(new ApiError(500, "Database connection is missing"));
});


app.delete("/api/v1/social-media/posts/reset-posts", async (req, res) => {
  if (dbInstance) {
    try {
      // Drop the 'feedposts' collection using mongoose
      await dbInstance.connection.dropCollection('socialposts');

      // Optionally, remove associated files (if needed)
      const directory = "./public/images";
      fs.readdir(directory, (err, files) => {
        if (err) {
          console.log("Error while removing the images: ", err);
        } else {
          files.forEach((file) => {
            if (file !== ".gitkeep") {
              fs.unlink(path.join(directory, file), (err) => {
                if (err) throw err;
              });
            }
          });
        }
      });

      // Clean up any other relevant files related to feedposts
      fs.unlink("./public/temp/Post-seed-credentials.json", (err) => {
        if (err) console.log("Post seed credentials are missing.");
      });

      return res.status(200).json(new ApiResponse(200, null, "posts table dropped successfully"));
    } catch (error) {
      console.error("Error dropping the feedposts table: ", error);
      return res.status(500).json(new ApiError(500, "Something went wrong while dropping the feedposts table"));
    }
  }
  return res.status(500).json(new ApiError(500, "Database connection is missing"));
});
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

// common error handling middleware
app.use(errorHandler);

export { httpServer };
