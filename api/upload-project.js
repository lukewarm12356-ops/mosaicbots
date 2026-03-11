// /api/upload-project.js
// Receives a zip file, extracts it, uploads every file to Firebase Storage
// preserving folder structure, returns the root storage path.
// Called by the frontend when projectType === "complex"

import { initializeApp, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { credential } from "firebase-admin";
import JSZip from "jszip";

// Init Firebase Admin (reuse if already initialized)
let adminApp;
try {
  adminApp = getApps()[0] || initializeApp({
    credential: credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}")),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "mosaicbots.firebasestorage.app",
  });
} catch (e) {
  adminApp = getApps()[0];
}

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export const config = {
  api: { bodyParser: false }, // We handle raw body manually
};

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-bot-id, x-user-id");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const botId = req.headers["x-bot-id"];
  const userId = req.headers["x-user-id"];
  if (!botId || !userId) return res.status(400).json({ error: "Missing x-bot-id or x-user-id headers" });

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return res.status(400).json({ error: "Failed to read request body" });
  }

  if (body.length > MAX_SIZE) {
    return res.status(413).json({ error: "File too large. Maximum size is 50MB." });
  }

  // Parse zip
  let zip;
  try {
    zip = await JSZip.loadAsync(body);
  } catch (e) {
    return res.status(400).json({ error: "Invalid zip file. Make sure you uploaded a valid .zip archive." });
  }

  // Validate: must have index.html somewhere reasonable
  const files = Object.keys(zip.files).filter(name => !zip.files[name].dir);
  const hasIndex = files.some(name => {
    const parts = name.split("/").filter(Boolean);
    // Accept index.html at root OR one folder deep (e.g. myapp/index.html)
    return parts[parts.length - 1].toLowerCase() === "index.html" && parts.length <= 2;
  });

  if (!hasIndex) {
    return res.status(400).json({ error: "Your zip must contain an index.html file at the root level." });
  }

  // Detect root folder prefix (some zips wrap everything in a folder)
  let rootPrefix = "";
  const topLevelDirs = new Set(
    files.map(name => name.split("/")[0])
  );
  if (topLevelDirs.size === 1) {
    const candidate = [...topLevelDirs][0];
    // Check if index.html is inside this folder
    const inFolder = files.find(name => name === `${candidate}/index.html`);
    if (inFolder) rootPrefix = candidate + "/";
  }

  // Upload all files to Firebase Storage under projects/{userId}/{botId}/
  const bucket = getStorage(adminApp).bucket();
  const storagePath = `projects/${userId}/${botId}`;
  const uploadResults = [];
  const errors = [];

  for (const filePath of files) {
    // Skip Mac metadata files
    if (filePath.includes("__MACOSX") || filePath.includes(".DS_Store")) continue;

    const relativePath = rootPrefix ? filePath.replace(rootPrefix, "") : filePath;
    if (!relativePath) continue;

    try {
      const content = await zip.files[filePath].async("nodebuffer");
      const destPath = `${storagePath}/${relativePath}`;

      // Detect MIME type
      const ext = relativePath.split(".").pop().toLowerCase();
      const mimeMap = {
        html: "text/html", htm: "text/html",
        js: "application/javascript", mjs: "application/javascript",
        css: "text/css",
        json: "application/json",
        png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
        gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
        ico: "image/x-icon",
        mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav",
        mp4: "video/mp4", webm: "video/webm",
        woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf",
        wasm: "application/wasm",
        txt: "text/plain", md: "text/markdown",
        xml: "application/xml", pdf: "application/pdf",
      };
      const contentType = mimeMap[ext] || "application/octet-stream";

      const fileRef = bucket.file(destPath);
      await fileRef.save(content, {
        metadata: {
          contentType,
          cacheControl: "public, max-age=3600",
        },
      });
      await fileRef.makePublic();

      uploadResults.push({ path: relativePath, destPath });
    } catch (e) {
      console.error(`Failed to upload ${filePath}:`, e);
      errors.push(filePath);
    }
  }

  if (uploadResults.length === 0) {
    return res.status(500).json({ error: "Failed to upload any files from the zip." });
  }

  // Return the project root storage path
  const projectRoot = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET || "mosaicbots.firebasestorage.app"}/${storagePath}/`;
  const indexUrl = `${projectRoot}index.html`;

  return res.status(200).json({
    success: true,
    projectRoot,
    indexUrl,
    storagePath,
    fileCount: uploadResults.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
