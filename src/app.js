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
import { dbInstance } from "./DataBase/index.js";
import {
  initializeSocketIO,
  initializeSocket,
  initializeSocketIOT,
} from "./Sockets/socket.js";
import { ApiError } from "./Utils/API_Errors.js";
import { ApiResponse } from "./Utils/API_Response.js";

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

global.io = io;
app.set("io", io);

// ============================================================
// GLOBAL MIDDLEWARES
// ============================================================
app.use(
  Cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_, __, ___, options) => {
    throw new ApiError(
      options.statusCode || 500,
      `There are too many requests. You are only allowed ${options.max} requests per ${options.windowMs / 60000} minutes`
    );
  },
});
app.use(limiter);

app.use(Express.json({ limit: "16kb" }));
app.use(Express.urlencoded({ extended: true, limit: "16kb" }));
app.use(Express.static("public"));
app.use(CookieParser());
app.use(Body_Parser.json());

app.use(
  Session({
    secret: process.env.EXPRESS_SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
  })
);
app.use(Passport.initialize());
app.use(Passport.session());

// ============================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================
import { errorHandler } from "./Middle_Wares/Error_Middle_Ware.js";

// ============================================================
// PUBLIC API ROUTES (No auth required)
// ============================================================
// NOTE: Your repo has no Public Routes folder — add these files
// if you need them, or remove these imports if unused.
// import Book_Router           from "./Routes/OverView/Public/Book_Routes.js";
// import Cat_Router            from "./Routes/OverView/Public/Cat_Routes.js";
// import Dog_Router            from "./Routes/OverView/Public/Dog_Routes.js";
// import Meal_Router           from "./Routes/OverView/Public/Meal_Routes.js";
// import Quote_Router          from "./Routes/OverView/Public/Quote_Routes.js";
// import Random_Joke_Router    from "./Routes/OverView/Public/Random_Joke_Routes.js";
// import Random_Product_Router from "./Routes/OverView/Public/Random_Product_Routes.js";
// import Random_User_Router    from "./Routes/OverView/Public/Random_User_Routes.js";
// import Youtube_Router        from "./Routes/OverView/Public/Youtube_Routes.js";

// ============================================================
// USER & AUTHENTICATION ROUTES
// ============================================================
import Users_Router         from "./Routes/OverView/Aunthentication/User_Routes.js";
import Users_Routes         from "./Routes/Users_Routes.js";
import User_Location_Router from "./Routes/Location/User_Location_Routes.js";

// ============================================================
// BUSINESS ROUTES
// ============================================================
import Business_Router                    from "./Routes/OverView/Business/Business_Profile_Routes.js";
import Catalogue_Router                   from "./Routes/OverView/Business/Catalogue_Routes.js";
import Business_Post_Router               from "./Routes/OverView/Business/Business_Post_Routes.js";
import Business_Post_Likes_Router         from "./Routes/OverView/Business/Business_Post_Like_Routes.js";
import Business_Post_Comments_Router      from "./Routes/OverView/Business/Business_Post_Comment_Routes.js"; // NOTE: file is Business_Post_Routes — check if Comment routes exist separately
import Business_Post_Comment_Reply_Router from "./Routes/OverView/Business/Business_Post_Comment_Reply_Routes.js";
import Business_Post_Bookmark_Router      from "./Routes/OverView/Business/Business_Post_Bookmark_Routes.js";

// ============================================================
// NOTIFICATION ROUTES
// ============================================================
// NOTE: No Notification route files found in your repo.
// Create them or comment these out if not yet built.
// import Notification_Router         from "./Routes/OverView/Notifications/Notification_Routes.js";
// import Business_Notification_Router from "./Routes/OverView/Notifications/Business_Notification_Routes.js";

// ============================================================
// GIF ROUTES
// ============================================================
import Gif_Router from "./Routes/OverView/GIF/Gif_Routes.js";

// ============================================================
// ECOMMERCE ROUTES
// ============================================================
import Address_Router      from "./Routes/OverView/Ecommerce/Address_Routes.js";
import Cart_Router         from "./Routes/OverView/Ecommerce/Cart_Routes.js";
import Category_Router     from "./Routes/OverView/Ecommerce/Category_Routes.js";
import Coupon_Router       from "./Routes/OverView/Ecommerce/Coupon_Routes.js";
import Order_Router        from "./Routes/OverView/Ecommerce/Order_Routes.js";
import Product_Router      from "./Routes/OverView/Ecommerce/Product_Routes.js";
import Ecom_Profile_Router from "./Routes/OverView/Ecommerce/Profile_Routes.js";

// ============================================================
// SOCIAL MEDIA / SHORTS ROUTES
// ============================================================
import Social_Block_Router                    from "./Routes/OverView/Shorts/Block_Routes.js";
import Social_Bookmark_Router                 from "./Routes/OverView/Shorts/Bookmark_Routes.js";
import Social_Comment_Router                  from "./Routes/OverView/Shorts/Comment_Routes.js";
import Social_Comment_Reply_Router            from "./Routes/OverView/Shorts/Comment_Reply_Routes.js";
import Social_Follow_Router                   from "./Routes/OverView/Shorts/Follow_Routes.js";
import Social_Like_Router                     from "./Routes/OverView/Shorts/Like_Routes.js";
import Social_Post_Router                     from "./Routes/OverView/Shorts/Post_Routes.js";
import Social_Profile_Router                  from "./Routes/OverView/Shorts/Profile_Routes.js";
import User_Following_Show_More_Options_Router from "./Routes/OverView/Shorts/User_Following_Show_More_Options_Routes.js";
import Social_Repost_Router                   from "./Routes/OverView/Shorts/Repost_Routes.js";
import Social_Share_Router                    from "./Routes/OverView/Shorts/Share_Routes.js";

// ============================================================
// FEED POST ROUTES
// ============================================================
import Feed_Router               from "./Routes/OverView/Feed/Feed_Routes.js";
import Feed_Like_Router          from "./Routes/OverView/Feed/Feed_Like_Routes.js";
import Feed_Comment_Router       from "./Routes/OverView/Feed/Feed_Comment_Routes.js";
import Feed_Comment_Reply_Router from "./Routes/OverView/Feed/Feed_Comment_Reply_Routes.js";
import Feed_Bookmark_Router      from "./Routes/OverView/Feed/Feed_Bookmark_Routes.js";
import Feed_Repost_Router        from "./Routes/OverView/Feed/Feed_Repost_Routes.js";
import Feed_Share_Router         from "./Routes/OverView/Feed/Feed_Share_Routes.js";
import Feed_Followed_Router      from "./Routes/OverView/Feed/Feed_Follow_Unfollow_Routes.js";

// ============================================================
// RECOMMENDATION / EVENTS ROUTES
// ============================================================
import Recomendation_Events_Router from "./Routes/OverView/Events/Events_Routes.js";

// ============================================================
// CHAT APP ROUTES
// ============================================================
import Chat_Router    from "./Routes/OverView/Messages/Chats_Routes.js";
import Message_Router from "./Routes/OverView/Messages/Message_Routes.js";

// ============================================================
// KITCHEN SINK ROUTES (Testing/Utility)
// NOTE: No Kitchen-Sink route folder found in your repo.
// These are commented out — create the files if needed.
// ============================================================

import Cookie_Router              from "./Routes/Sink/Cookie_Routes.js";
import Http_Method_Router         from "./Routes/Sink/HttpMethod_Routes.js";
import Image_Router               from "./Routes/Sink/Image_Routes.js";
import Redirect_Router            from "./Routes/Sink/Redirect_Routes.js";
import Request_Inspection_Router  from "./Routes/Sink/RequestInspection_Routes.js";
import Response_Inspection_Router from "./Routes/Sink/ResponseInspection_Routes.js";
import Status_Code_Router         from "./Routes/Sink/StatusCode_Routes.js";

// ============================================================
// DATABASE SEEDING HANDLERS
// NOTE: No Seeds folder found in your repo.
// Comment these out until you create the seed files.
// ============================================================
// import { seedChatApp }                        from "./Seeds/Chat-App.Seeds.js";
// import { seedEcommerce }                      from "./Seeds/Ecommerce.Seeds.js";
// import { seedSocialMedia }                    from "./Seeds/Social-Media.Seeds.js";
// import { seedTodos }                          from "./Seeds/Todo.Seeds.js";
// import { getGeneratedCredentials, seedUsers } from "./Seeds/User.Seeds.js";

// ============================================================
// ROUTE MOUNTING
// ============================================================

// -- User & Auth
app.use("/api/v1/users", Users_Router);
app.use("/users",        Users_Routes);

// -- Notifications (uncomment when route files are created)
// app.use("/api/v1/notifications",          Notification_Router);
// app.use("/api/v1/business/notifications", Business_Notification_Router);

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
app.use("/api/v1/feed/followed",      Feed_Followed_Router);
app.use("/api/v1/feed/post",          Feed_Router);
app.use("/api/v1/feed/likes",         Feed_Like_Router);
app.use("/api/v1/feed/comments",      Feed_Comment_Router);
app.use("/api/v1/feed/comment/reply", Feed_Comment_Reply_Router);
app.use("/api/v1/feed/bookmarks",     Feed_Bookmark_Router);
app.use("/api/v1/feed/repost",        Feed_Repost_Router);
app.use("/api/v1/feed/share",         Feed_Share_Router);

// -- Ecommerce
app.use("/api/v1/ecommerce/categories", Category_Router);
app.use("/api/v1/ecommerce/addresses",  Address_Router);
app.use("/api/v1/ecommerce/products",   Product_Router);
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
app.use("/api/v1/social-media/options",       User_Following_Show_More_Options_Router);
app.use("/api/v1/social-media/reposts",       Social_Repost_Router);
app.use("/api/v1/social-media/shares",        Social_Share_Router);

// -- Chat App
app.use("/api/v1/chat-app/chats",    Chat_Router);
app.use("/api/v1/chat-app/messages", Message_Router);

// -- User Location
app.use("/api/v1/userlocation", User_Location_Router);

// -- Recommendation Events
app.use("/api/v1/recommendations/events", Recomendation_Events_Router);

// -- Public APIs (uncomment when route files are created)
// app.use("/api/v1/public/randomusers",    Random_User_Router);
// app.use("/api/v1/public/randomproducts", Random_Product_Router);
// app.use("/api/v1/public/randomjokes",    Random_Joke_Router);
// app.use("/api/v1/public/books",          Book_Router);
// app.use("/api/v1/public/quotes",         Quote_Router);
// app.use("/api/v1/public/meals",          Meal_Router);
// app.use("/api/v1/public/dogs",           Dog_Router);
// app.use("/api/v1/public/cats",           Cat_Router);
// app.use("/api/v1/public/youtube",        Youtube_Router);

// --  Sink (uncomment when route files are created)
app.use("/api/v1/sink/http-methods", Http_Method_Router);
app.use("/api/v1/sink/status-codes", Status_Code_Router);
app.use("/api/v1/sink/request",      Request_Inspection_Router);
app.use("/api/v1/sink/response",     Response_Inspection_Router);
app.use("/api/v1/sink/cookies",      Cookie_Router);
app.use("/api/v1/sink/redirect",     Redirect_Router);
app.use("/api/v1/sink/image",        Image_Router);

// -- Seeding (uncomment when seed files are created)
// app.get("/api/v1/seed/generated-credentials", getGeneratedCredentials);
// app.post("/api/v1/seed/todos",        seedTodos);
// app.post("/api/v1/seed/ecommerce",    seedUsers, seedEcommerce);
// app.post("/api/v1/seed/social-media", seedUsers, seedSocialMedia);
// app.post("/api/v1/seed/chat-app",     seedUsers, seedChatApp);

// ============================================================
// SOCKET.IO INITIALIZATION
// ============================================================
initializeSocket(io);

// ============================================================
// DANGER ZONE — Database Reset Endpoints
// ============================================================
app.delete("/api/v1/reset-db", async (req, res) => {
  if (dbInstance) {
    await dbInstance.connection.db.dropDatabase({ dbName: DB_NAME });

    const directory = "./public/images";
    Fs.readdir(directory, (err, files) => {
      if (err) {
        console.log("Error while removing the images: ", err);
      } else {
        for (const file of files) {
          if (file === ".gitkeep") continue;
          Fs.unlink(Path.join(directory, file), (err) => {
            if (err) throw err;
          });
        }
      }
    });

    Fs.unlink("./public/temp/seed-credentials.json", (err) => {
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
      await dbInstance.connection.dropCollection("feedposts");

      const directory = "./public/images";
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

app.delete("/api/v1/social-media/posts/reset-posts", async (req, res) => {
  if (dbInstance) {
    try {
      await dbInstance.connection.dropCollection("socialposts");

      const directory = "./public/images";
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
// API DOCUMENTATION — Swagger UI
// ============================================================
app.use(
  "/",
  Swagger_Ui.serve,
  Swagger_Ui.setup(swaggerDocument, {
    swaggerOptions: {
      docExpansion: "none",
    },
    customSiteTitle: "FreeAPI docs",
  })
);

// ============================================================
// GLOBAL ERROR HANDLER (must be last middleware)
// ============================================================
app.use(errorHandler);

export { httpServer };