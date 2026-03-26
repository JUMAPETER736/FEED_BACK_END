import multer from "multer";
import fs from "fs";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // This storage needs public/images folder in the root directory
    // Else it will throw an error saying cannot find path public/images
    // console.log("shorts multer")
    // console.log(`file.fieldname: ${file.fieldname}`);
    // cb(null, "./public/images");
    const { contentType } = req.body;
    // console.log(req.body);

    if (file.fieldname === "images") {
      cb(null, "./public/images");
      // cb(null, './public/thumbnail');
      // cb(null, './public/profileimages');
      console.log("shorts multer images");
    } else if (file.fieldname === "feed_thumbnail") {
      console.log("feed thumbnail");
      cb(null, "./public/feed_thumbnail");
    } else if (file.fieldname === "files") {
      // console.log(req.body)
      // const contentType = req.body['content-type'];

      if (contentType == "mixed_files") {
        try {
          // console.log("Saving via multler 1");
          cb(null, "./public/feed_mixed_files");
          // console.log("Saving via multler 2");
        } catch (error) {
          console.log(`Multer error $error`);
        }
      } else if (contentType == "image") {
        cb(null, "./public/feed_images");
      } else if (contentType == "audio") {
        cb(null, "./public/feed_audio");
      } else if (contentType == "video") {
        console.log(`feed type is video`);
        cb(null, "./public/feed_video");
      } else if (contentType == "docs") {
        cb(null, "./public/feed_docs");
      } else if (contentType == "vn") {
        cb(null, "./public/feed_vn");
      } else if (contentType == "multiple_images") {
        console.log("multiple");
        cb(null, "./public/feed_multiple_images");
      }
      // Do something with contentType
      // console.log('Content-Type:', contentType)
    } else if (file.fieldname === "thumbnail") {
      cb(null, "./public/thumbnail");
      console.log("shorts multer thumbnail");
    } else if (file.fieldname === "avatar") {
      cb(null, "./public/profileimages");
      console.log("shorts multer thumbnail");
    } else if (file.fieldname === "background") {
      cb(null, "public/business/background");
      console.log("business background image ");
      // Ensure the directory exists
      if (!fs.existsSync("public/business/background")) {
        fs.mkdirSync("public/business/background", { recursive: true });
      }
    } else if (file.fieldname === "b_vid") {
      cb(null, "public/business/v");

      if (!fs.existsSync("public/business/v")) {
        fs.mkdirSync("public/business/v", { recursive: true });
      }
    } else if (file.fieldname === "b_thumb") {
      cb(null, "public/business/t");
      if (!fs.existsSync("public/business/t")) {
        fs.mkdirSync("public/business/t", { recursive: true });
      }
    } else if (file.fieldname === "product") {
      cb(null, "public/business/products");
      console.log("business products");
      if (!fs.existsSync("public/business/products")) {
        fs.mkdirSync("public/business/products");
      }
    } else if (file.fieldname === "attachments") {
      cb(null, "public/images");
    } else {
      cb(new Error(`Invalid fieldname $ - ${file.fieldname}`));
      console.log("shorts multer error");
    }
  },
  // Store file in a .png/.jpeg/.jpg format instead of binary
  filename: function (req, file, cb) {
    let fileExtension = "";
    if (file.originalname.split(".").length > 1) {
      fileExtension = file.originalname.substring(
        file.originalname.lastIndexOf(".")
      );
    }
    const filenameWithoutExtension = file.originalname
      .toLowerCase()
      .split(" ")
      .join("-")
      ?.split(".")[0];
    cb(
      null,
      filenameWithoutExtension +
        Date.now() +
        Math.ceil(Math.random() * 1e5) + // avoid rare name conflict
        fileExtension
    );
  },
});

// Middleware responsible to read form data and upload the File object to the mentioned path
export const upload = multer({
  storage,
});
