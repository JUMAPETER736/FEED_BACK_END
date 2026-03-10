// ============================================================
// CORE DEPENDENCIES
// ============================================================
import CookieParser from "cookie-parser";
import Cors from "cors";
import Express from "express";
import Body_Parser from "body-parser";
import { rateLimit } from "express-rate-limit";
import Session from "express-session";
import Fs from "fs";
import { createServer } from "http";
import Passport from "passport";
import Path from "path";
import { Server } from "socket.io";
import Swagger_Ui from "swagger-ui-express";
import { fileURLToPath } from "url";
import YAML from "yaml";

// ============================================================
// DATABASE & INTERNAL UTILITIES
// ============================================================
import { DB_NAME } from "./constants.js";
import { dbInstance } from "./db/index.js";
import {
  initializeSocketIO,
  initializeSocket,
  initializeSocketIOT,
} from "./socket/socket.js";
import { ApiError } from "./utils/ApiError.js";
import { ApiResponse } from "./utils/ApiResponse.js";

// ============================================================
// FILE PATH SETUP (ESM __dirname equivalent)
// ============================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);

// ============================================================
// SWAGGER DOCUMENTATION SETUP
// ============================================================
const file = Fs.readFileSync(Path.resolve(__dirname, "./swagger.yaml"), "utf8");
const swaggerDocument = YAML.parse(file);

// ============================================================
// APP & HTTP SERVER INITIALIZATION
// ============================================================
const app = Express();
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

// Store the io instance globally and on app
global.io = io;
app.set("io", io); // Preferred over global — avoids polluting the global scope

// ============================================================
// GLOBAL MIDDLEWARES
// ============================================================

// -- CORS: Allow requests from specified origin
app.use(
  Cors({
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

// -- BODY PARSERS: Handle JSON, URL-encoded, and static files
app.use(Express.json({ limit: "16kb" }));
app.use(Express.urlencoded({ extended: true, limit: "16kb" }));
app.use(Express.static("public")); // Serve static files (e.g., images) from /public
app.use(CookieParser());
app.use(Body_Parser.json()); // Parse JSON payloads

// -- SESSION & PASSPORT: Authentication support
app.use(
  Session({
    secret: process.env.EXPRESS_SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
  })
);
app.use(Passport.initialize());
app.use(Passport.session()); // Enable persistent login sessions

// ============================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================
import { errorHandler } from "./Middlewares/Error.Middlewares.js";

// ============================================================
// HEALTHCHECK ROUTE
// ============================================================
import Healthcheck_Router from "./Routes/Healthcheck.Routes.js";

// ============================================================
// PUBLIC API ROUTES (No auth required)
// ============================================================
import Book_Router           from "./Routes/Public/Book.Routes.js";
import Cat_Router            from "./Routes/Public/Cat.Routes.js";
import Dog_Router            from "./Routes/Public/Dog.Routes.js";
import Meal_Router           from "./Routes/Public/Meal.Routes.js";
import Quote_Router          from "./Routes/Public/Quote.Routes.js";
import Random_Joke_Router    from "./Routes/Public/RandomJoke.Routes.js";
import Random_Product_Router from "./Routes/Public/RandomProduct.Routes.js";
import Random_User_Router    from "./Routes/Public/RandomUser.Routes.js";
import Youtube_Router        from "./Routes/Public/Youtube.Routes.js";

// ============================================================
// USER & AUTHENTICATION ROUTES
// ============================================================
import Users_Router       from "./Routes/Apps/Auth/User.Routes.js";
import Users_Routes       from "./Routes/Users_Routes.js";
import User_Location_Router from "./Routes/Location/User.Location.Route.js";

// ============================================================
// BUSINESS ROUTES
// ============================================================
import Business_Router                   from "./Routes/Apps/Business/Profile.Routes.js";
import Catalogue_Router                  from "./Routes/Apps/Business/Catalogue.Routes.js";
import Business_Post_Router              from "./Routes/Apps/Business/Business.Post.Routes.js";
import Business_Post_Likes_Router        from "./Routes/Apps/Business/BusinessPost/Business.Post.Like.Routes.js";
import Business_Post_Comments_Router     from "./Routes/Apps/Business/BusinessPost/Business.Post.Comment.Routes.js";
import Business_Post_Comment_Reply_Router from "./Routes/Apps/Business/BusinessPost/Business.Post.Comment.Reply.Routes.js";
import Business_Post_Bookmark_Router     from "./Routes/Apps/Business/BusinessPost/Business.Post.Bookmark.Routes.js";
import Business_Notification_Router      from "./Routes/Apps/Notifications/Business.Notification.Routes.js";

// ============================================================
// NOTIFICATION ROUTES
// ============================================================
import Notification_Router from "./Routes/Apps/Notifications/Notification.Routes.js";

// ============================================================
// GIF ROUTES
// ============================================================
import Gif_Router from "./Routes/Apps/Gif/Gif.Route.js";

// ============================================================
// ECOMMERCE ROUTES
// ============================================================
import Address_Router     from "./Routes/Apps/Ecommerce/Address.Routes.js";
import Cart_Router        from "./Routes/Apps/Ecommerce/Cart.Routes.js";
import Category_Router    from "./Routes/Apps/Ecommerce/Category.Routes.js";
import Coupon_Router      from "./Routes/Apps/Ecommerce/Coupon.Routes.js";
import Order_Router       from "./Routes/Apps/Ecommerce/Order.Routes.js";
import Product_Router     from "./Routes/Apps/Ecommerce/Product.Routes.js";
import Ecom_Profile_Router from "./Routes/Apps/Ecommerce/Profile.Routes.js";

// ============================================================
// SOCIAL MEDIA / SHORTS ROUTES
// ============================================================
import Social_Block_Router                  from "./Routes/Apps/Social-Media/Block.Routes.js";
import Social_Bookmark_Router               from "./Routes/Apps/Social-Media/Bookmark.Routes.js";
import Social_Comment_Router                from "./Routes/Apps/Social-Media/Comment.Routes.js";
import Social_Comment_Reply_Router          from "./Routes/Apps/Social-Media/Comment.Reply.Routes.js";
import Social_Follow_Router                 from "./Routes/Apps/Social-Media/Follow.Routes.js";
import Social_Like_Router                   from "./Routes/Apps/Social-Media/Like.Routes.js";
import Social_Post_Router                   from "./Routes/Apps/Social-Media/Post.Routes.js";
import Social_Profile_Router                from "./Routes/Apps/Social-Media/Profile.Routes.js";
import User_Following_Show_More_Options_Router from "./Routes/Apps/Social-Media/UserFollowingShowMoreOptions.Routes.js";
import Social_Repost_Router                 from "./Routes/Apps/Social-Media/Repost.Routes.js";
import Social_Share_Router                  from "./Routes/Apps/Social-Media/Share.Routes.js";

// ============================================================
// FEED POST ROUTES
// ============================================================
import Feed_Router              from "./Routes/Apps/Feed/Feed.Routes.js";
import Feed_Like_Router         from "./Routes/Apps/Feed/Feed_Like.Routes.js";
import Feed_Comment_Router      from "./Routes/Apps/Feed/Feed_Comment.Routes.js";
import Feed_Comment_Reply_Router from "./Routes/Apps/Feed/Feed_Comment.Reply.Routes.js";
import Feed_Bookmark_Router     from "./Routes/Apps/Feed/Feed_Bookmark.Routes.js";
import Feed_Repost_Router       from "./Routes/Apps/Feed/Feed_Repost.Routes.js";
import Feed_Share_Router        from "./Routes/Apps/Feed/Feed_Share.Routes.js";
import Feed_Followed_Router     from "./Routes/Apps/Feed/Feed_FollowUnfollow.Routes.js";

// ============================================================
// RECOMMENDATION / EVENTS ROUTES
// ============================================================
import Recomendation_Events_Router from "./Routes/Apps/Events/Events.Routes.js";

// ============================================================
// CHAT APP ROUTES
// ============================================================
import Chat_Router    from "./Routes/Apps/Chat-App/Chat.Routes.js";
import Message_Router from "./Routes/Apps/Chat-App/Message.Routes.js";

// ============================================================
// TODO ROUTES
// ============================================================
import Todo_Router from "./Routes/Apps/Todo/Todo.Routes.js";

// ============================================================
// KITCHEN SINK ROUTES (Testing/Utility)
// ============================================================
import Cookie_Router              from "./Routes/Kitchen-Sink/Cookie.Routes.js";
import Http_Method_Router         from "./Routes/Kitchen-Sink/HttpMethod.Routes.js";
import Image_Router               from "./Routes/Kitchen-Sink/Image.Routes.js";
import Redirect_Router            from "./Routes/Kitchen-Sink/Redirect.Routes.js";
import Request_Inspection_Router  from "./Routes/Kitchen-Sink/RequestInspection.Routes.js";
import Response_Inspection_Router from "./Routes/Kitchen-Sink/ResponseInspection.Routes.js";
import Status_Code_Router         from "./Routes/Kitchen-Sink/StatusCode.Routes.js";

// ============================================================
// DATABASE SEEDING HANDLERS
// ============================================================
import { seedChatApp }                        from "./Seeds/Chat-App.Seeds.js";
import { seedEcommerce }                      from "./Seeds/Ecommerce.Seeds.js";
import { seedSocialMedia }                    from "./Seeds/Social-Media.Seeds.js";
import { seedTodos }                          from "./Seeds/Todo.Seeds.js";
import { getGeneratedCredentials, seedUsers } from "./Seeds/User.Seeds.js";

// ============================================================
// ROUTE MOUNTING
// ============================================================

// -- Healthcheck
app.use("/api/v1/healthcheck", Healthcheck_Router);

// -- Public APIs (no auth required)
app.use("/api/v1/public/randomusers",    Random_User_Router);
app.use("/api/v1/public/randomproducts", Random_Product_Router);
app.use("/api/v1/public/randomjokes",    Random_Joke_Router);
app.use("/api/v1/public/books",          Book_Router);
app.use("/api/v1/public/quotes",         Quote_Router);
app.use("/api/v1/public/meals",          Meal_Router);
app.use("/api/v1/public/dogs",           Dog_Router);
app.use("/api/v1/public/cats",           Cat_Router);
app.use("/api/v1/public/youtube",        Youtube_Router);

// -- User & Auth
app.use("/api/v1/users", Users_Router);
app.use("/users",        Users_Routes);

// -- Notifications
app.use("/api/v1/notifications",          Notification_Router);
app.use("/api/v1/business/notifications", Business_Notification_Router);

// -- Business
app.use("/api/v1/business/profile",                        Business_Router);
app.use("/api/v1/business/catalogue",                      Catalogue_Router);
app.use("/api/v1/business/product-posts",                  Business_Post_Router);
app.use("/api/v1/business/product-posts/likes",            Business_Post_Likes_Router);
app.use("/api/v1/business/product-posts/comments",         Business_Post_Comments_Router);
app.use("/api/v1/business/product-posts/comments/replies", Business_Post_Comment_Reply_Router);
app.use("/api/v1/business/products-posts/bookmarks",       Business_Post_Bookmark_Router);

// -- GIF
app.use("/api/v1/gif", Gif_Router);

// -- Feed Posts
app.use("/api/v1/feed/followed",       Feed_Followed_Router);
app.use("/api/v1/feed/post",           Feed_Router);
app.use("/api/v1/feed/likes",          Feed_Like_Router);
app.use("/api/v1/feed/comments",       Feed_Comment_Router);
app.use("/api/v1/feed/comment/reply",  Feed_Comment_Reply_Router);
app.use("/api/v1/feed/bookmarks",      Feed_Bookmark_Router);
app.use("/api/v1/feed/repost",         Feed_Repost_Router);
app.use("/api/v1/feed/share",          Feed_Share_Router);

// -- Ecommerce
app.use("/api/v1/ecommerce/categories", Category_Router);
app.use("/api/v1/ecommerce/addresses",  Address_Router);
app.use("/api/v1/ecommerce/productSs",  Product_Router);
app.use("/api/v1/ecommerce/profile",    Ecom_Profile_Router);
app.use("/api/v1/ecommerce/cart",       Cart_Router);
app.use("/api/v1/ecommerce/orders",     Order_Router);
app.use("/api/v1/ecommerce/coupons",    Coupon_Router);

// -- Social Media / Shorts
app.use("/api/v1/social-media/block",         Social_Block_Router);
app.use("/api/v1/social-media/profile",       Social_Profile_Router);
app.use("/api/v1/social-media/follow",        Social_Follow_Router);
app.use("/api/v1/social-media/posts",         Social_Post_Router);
app.use("/api/v1/social-media/likes",         Social_Like_Router);
app.use("/api/v1/social-media/bookmarks",     Social_Bookmark_Router);
app.use("/api/v1/social-media/comments",      Social_Comment_Router);
app.use("/api/v1/social-media/comment/reply", Social_Comment_Reply_Router);
app.use("/api/v1/social-media/profile",       User_Following_Show_More_Options_Router);
app.use("/api/v1/social-media/reposts",       Social_Repost_Router);
app.use("/api/v1/social-media/shares",        Social_Share_Router);

// -- Chat App
app.use("/api/v1/chat-app/chats",    Chat_Router);
app.use("/api/v1/chat-app/messages", Message_Router);

// -- Todos
app.use("/api/v1/todos", Todo_Router);

// -- Kitchen Sink (Testing/Utility APIs)
app.use("/api/v1/kitchen-sink/http-methods",  Http_Method_Router);
app.use("/api/v1/kitchen-sink/status-codes",  Status_Code_Router);
app.use("/api/v1/kitchen-sink/request",       Request_Inspection_Router);
app.use("/api/v1/kitchen-sink/response",      Response_Inspection_Router);
app.use("/api/v1/kitchen-sink/cookies",       Cookie_Router);
app.use("/api/v1/kitchen-sink/redirect",      Redirect_Router);
app.use("/api/v1/kitchen-sink/image",         Image_Router);

// -- User Location
app.use("/api/v1/userlocation", User_Location_Router);

// -- Recommendation Events
app.use("/api/v1/recommendations/events", Recomendation_Events_Router);

// ============================================================
// SEEDING ENDPOINTS
// ============================================================
app.get("/api/v1/seed/generated-credentials", getGeneratedCredentials);
app.post("/api/v1/seed/todos",        seedTodos);
app.post("/api/v1/seed/ecommerce",    seedUsers, seedEcommerce);
app.post("/api/v1/seed/social-media", seedUsers, seedSocialMedia);
app.post("/api/v1/seed/chat-app",     seedUsers, seedChatApp);

// ============================================================
// SOCKET.IO INITIALIZATION
// ============================================================
// initializeSocketIO(io);  // Alternative socket init (commented out)
initializeSocket(io);
// initializeSocketIOT(io); // Alternative socket init (commented out)

// ============================================================
// DANGER ZONE — Database Reset Endpoints
// ============================================================

/**
 * DELETE /api/v1/reset-db
 * Drops the ENTIRE database and clears all images and seed files.
 * Use with extreme caution — this is irreversible!
 */
app.delete("/api/v1/reset-db", async (req, res) => {
  if (dbInstance) {
    // Drop the entire database
    await dbInstance.connection.db.dropDatabase({ dbName: DB_NAME });

    const directory = "./public/images";

    // Remove all product images from the filesystem
    Fs.readdir(directory, (err, files) => {
      if (err) {
        console.log("Error while removing the images: ", err);
      } else {
        for (const file of files) {
          if (file === ".gitkeep") continue; // Preserve .gitkeep placeholder
          Fs.unlink(Path.join(directory, file), (err) => {
            if (err) throw err;
          });
        }
      }
    });

    // Remove the seeded credentials file if it exists
    Fs.unlink("./public/temp/seed-credentials.json", (err) => {
      if (err) console.log("Seed credentials are missing.");
    });

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Database dropped successfully"));
  }
  throw new ApiError(500, "Something went wrong while dropping the database");
});

/**
 * DELETE /api/v1/reset-feedposts
 * Drops only the 'feedposts' collection and cleans up related files.
 * This is irreversible for all feed post data!
 */
app.delete("/api/v1/reset-feedposts", async (req, res) => {
  if (dbInstance) {
    try {
      // Drop only the feedposts collection
      await dbInstance.connection.dropCollection("feedposts");

      const directory = "./public/images";

      // Remove associated image files
      Fs.readdir(directory, (err, files) => {
        if (err) {
          console.log("Error while removing the images: ", err);
        } else {
          files.forEach((file) => {
            if (file !== ".gitkeep") {
              Fs.unlink(Path.join(directory, file), (err) => {
                if (err) throw err;
              });
            }
          });
        }
      });

      // Remove feedpost seed credentials file
      Fs.unlink("./public/temp/feedpost-seed-credentials.json", (err) => {
        if (err) console.log("Feedpost seed credentials are missing.");
      });

      return res
        .status(200)
        .json(new ApiResponse(200, null, "Feedposts table dropped successfully"));
    } catch (error) {
      console.error("Error dropping the feedposts table: ", error);
      return res
        .status(500)
        .json(new ApiError(500, "Something went wrong while dropping the feedposts table"));
    }
  }
  return res
    .status(500)
    .json(new ApiError(500, "Database connection is missing"));
});

/**
 * DELETE /api/v1/social-media/posts/reset-posts
 * Drops only the 'socialposts' collection and cleans up related files.
 * This is irreversible for all social post data!
 */
app.delete("/api/v1/social-media/posts/reset-posts", async (req, res) => {
  if (dbInstance) {
    try {
      // Drop only the socialposts collection
      await dbInstance.connection.dropCollection("socialposts");

      const directory = "./public/images";

      // Remove associated image files
      Fs.readdir(directory, (err, files) => {
        if (err) {
          console.log("Error while removing the images: ", err);
        } else {
          files.forEach((file) => {
            if (file !== ".gitkeep") {
              Fs.unlink(Path.join(directory, file), (err) => {
                if (err) throw err;
              });
            }
          });
        }
      });

      // Remove social post seed credentials file
      Fs.unlink("./public/temp/Post-seed-credentials.json", (err) => {
        if (err) console.log("Post seed credentials are missing.");
      });

      return res
        .status(200)
        .json(new ApiResponse(200, null, "posts table dropped successfully"));
    } catch (error) {
      console.error("Error dropping the feedposts table: ", error);
      return res
        .status(500)
        .json(new ApiError(500, "Something went wrong while dropping the feedposts table"));
    }
  }
  return res
    .status(500)
    .json(new ApiError(500, "Database connection is missing"));
});

// ============================================================
// API DOCUMENTATION — Swagger UI (mounted on "/" root)
// Note: Kept at the end so it doesn't intercept other routes
// ============================================================
app.use(
  "/",
  Swagger_Ui.serve,
  Swagger_Ui.setup(swaggerDocument, {
    swaggerOptions: {
      docExpansion: "none", // Keep all sections collapsed by default
    },
    customSiteTitle: "FreeAPI docs",
  })
);

// ============================================================
// GLOBAL ERROR HANDLER (must be last middleware)
// ============================================================
app.use(errorHandler);

export { httpServer };