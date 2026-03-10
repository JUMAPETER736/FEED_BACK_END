// ============================================================
// CORE DEPENDENCIES
// ============================================================
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import sharp from "sharp";

// ============================================================
//  APP & DATABASE
// ============================================================
import { httpServer } from "./app.js";
import connectDB from "./db/index.js";

// ============================================================
// CANVAS IMPORTS (currently unused — kept for future use)
// ============================================================
// import { createCanvas, registerFont } from "canvas";

// ============================================================
// ENVIRONMENT CONFIGURATION
// ============================================================
// dotenv.config({ path: "./.env" });
// Note: Uncomment above if dotenv is not configured elsewhere (e.g. in app.js)

// ============================================================
// FILE PATH SETUP (ESM __dirname equivalent)
// ============================================================
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

// ============================================================
// AVATAR DIRECTORY SETUP
// ============================================================
const baseDir = path.join(__dirname, "..", "public", "avatars");

// Alternative path with space encoding fix (Windows-safe):
// const baseDir = path.join(__dirname, "..", "public", "avatars").replaceAll("%20", " ");

// Ensure the avatars directory exists (uncomment to auto-create on startup):
// fs.mkdirSync(path.join(__dirname, "..", "public"), { recursive: true });
// if (!fs.existsSync(baseDir)) {
//   fs.mkdirSync(baseDir, { recursive: true });
// }

// ============================================================
// FONT REGISTRATION (uncomment if using canvas with custom fonts)
// ============================================================
// registerFont('path/to/your/font.ttf', { family: 'FontFamily' });

// ============================================================
// SERVER STARTUP
// ============================================================

/**
 * Detect the current Node.js major version.
 * Top-level await is only supported in ES Modules with Node.js >= 14.
 */
const majorNodeVersion = +process.env.NODE_VERSION?.split(".")[0] || 0;

/**
 * Starts the HTTP server and logs the running port and docs URL.
 */
const startServer = () => {
  httpServer.listen(process.env.PORT || 8080, () => {
    console.info(
      `Visit the documentation at: http://localhost:${process.env.PORT || 8080}`
    );
    console.log("⚙️  Server is running on port: " + process.env.PORT);
  });
};

/**
 * Connect to MongoDB then start the server.
 * - Node >= 14: uses top-level await (ES Module support)
 * - Node  < 14: falls back to Promise chaining
 */
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

// ============================================================
// AVATAR GENERATION UTILITY
// ============================================================

/**
 * Generates a PNG avatar image for a given letter using Sharp.
 * Creates a 100x100 blue square with the letter rendered as white SVG text.
 *
 * @param {string} letter - The character to render on the avatar (e.g. "A")
 *
 * Output: Saves to /public/avatars/{LETTER}.png
 */
function generateInitialImage(letter) {
  const image = sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4, // RGBA
      background: { r: 52, g: 152, b: 219, alpha: 0.8 }, // Blue with 80% opacity
    },
  });

  // Overlay the letter as white SVG text centered on the image
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

  // Encode letter to safely use as a filename (handles special chars)
  const sanitizedLetter = encodeURIComponent(letter.toUpperCase());
  const imagePath = path.join(baseDir, `${sanitizedLetter}.png`);

  // Save the generated image to disk
  image.toFile(imagePath, (err) => {
    if (err) {
      console.error(`Error generating image for ${letter}: ${err}`);
    } else {
      console.log(`Image generated for ${letter}`);
    }
  });
}

// ============================================================
// BULK AVATAR GENERATION (A–Z)
// Uncomment to regenerate all letter avatars on startup
// ============================================================
// for (let i = 65; i <= 90; i++) { // ASCII 65 = 'A', 90 = 'Z'
//   const letter = String.fromCharCode(i);
//   generateInitialImage(letter);
// }