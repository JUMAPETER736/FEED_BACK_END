import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // This storage needs public/images folder in the root directory
    // Else it will throw an error saying cannot find path public/images
    console.log(`comments multer file filed name ${file.fieldname}`);
    // console.log(`comments multer file filed req ${req}`)

    // cb(null, "./public/images");

    // if(file.fieldname === "thu")
    if (file.fieldname === "image") {
      cb(null, "./public/feedcommentimages");
    } else if (file.fieldname === "video") {
      cb(null, "./public/feedcommentvideos");
      console.log("shorts multer video");
    } else if (file.fieldname === "thumbnail") {
      cb(null, "./public/feedcommentthumbnail");
      // console.log("shorts multer thumbnail")
    } else if (file.fieldname === "audio") {
      cb(null, "./public/feedcommentaudios");
      // console.log("shorts multer thumbnail")
    } else if (file.fieldname === "gif") {
      cb(null, "./public/feedcommentgifs");
      // console.log("shorts multer thumbnail")
    } else if (file.fieldname === "docs") {
      cb(null, "./public/feedcommentdocs");
      // console.log("shorts multer thumbnail")
    } else {
      cb(new Error(`Invalid fieldname $ - ${file.fieldname}`));
      console.log("comments multer error");
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
