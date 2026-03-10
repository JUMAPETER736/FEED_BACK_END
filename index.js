import dotenv from "dotenv";
import { httpServer } from "./app.js";
import connectDB from "./db/index.js";
//import { createCanvas, registerFont } from "canvas";
import fs from "fs";
import path from "path";
import sharp from "sharp";

// const __filename = new URL(import.meta.url).pathname;
// const __dirname = path.dirname(__filename);

// //const baseDir = path.join(__dirname, "..", "public", "avatars"); // Assuming your script is in the root directory

// const baseDir = path
//   .join(__dirname, "..", "public", "avatars")
//   .replaceAll("%20", " ");
// dotenv.config({
//   path: "./.env",
// });

/**
 * Starting from Node.js v14 top-level await is available and it is only available in ES modules.
 * This means you can not use it with common js modules or Node version < 14.
 */
const majorNodeVersion = +process.env.NODE_VERSION?.split(".")[0] || 0;

const startServer = () => {
  httpServer.listen(process.env.PORT || 8080, () => {
    console.info(
      `📑 Visit the documentation at: http://localhost:${
        process.env.PORT || 8080
      }`
    );
    console.log("⚙️  Server is running on port: " + process.env.PORT);
  });
};

if (majorNodeVersion >= 14) {
  try {
    await connectDB();
    startServer();
  } catch (err) {
    console.log("Mongo db connect error: ", err);
  }
} else {
  connectDB()
    .then(() => {
      startServer();
    })
    .catch((err) => {
      console.log("Mongo db connect error: ", err);
    });
}

// Load a font (if needed)
// registerFont('path/to/your/font.ttf', { family: 'FontFamily' });

// import { createCanvas, registerFont } from "canvas";
// import fs from "fs";
// import path from "path";

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

// Load a font (if needed)
// registerFont('path/to/your/font.ttf', { family: 'FontFamily' });

const baseDir = path.join(__dirname, "..", "public", "avatars");

// // Ensure the parent directories exist
// fs.mkdirSync(path.join(__dirname, "..", "public"), { recursive: true });

// // Ensure the avatars directory exists, create if not
// if (!fs.existsSync(baseDir)) {
//   fs.mkdirSync(baseDir, { recursive: true });
// }

function generateInitialImage(letter) {
  const image = sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 52, g: 152, b: 219, alpha: 0.8 }, // RGBA color (adjust as needed)
    },
  });

  // Composite text onto the image
  image.composite([
    {
      input: Buffer.from(
        `<svg><text x="25" y="60" font-family="Arial" font-size="30" fill="#ffffff">${letter}</text></svg>`
      ),
      left: 0,
      top: 0,
      blend: "over",
    },
  ]);

  // Save the image to a file in the avatars directory
  const sanitizedLetter = encodeURIComponent(letter.toUpperCase()); // Encode the letter
  const imagePath = path.join(baseDir, `${sanitizedLetter}.png`);

  image.toFile(imagePath, (err) => {
    if (err) {
      console.error(`Error generating image for ${letter}: ${err}`);
    } else {
      console.log(`Image generated for ${letter}`);
    }
  });
}

// Generate images for each letter
// for (let i = 65; i <= 90; i++) {
//   // ASCII codes for A to Z
//   const letter = String.fromCharCode(i);
//   generateInitialImage(letter);
// }
