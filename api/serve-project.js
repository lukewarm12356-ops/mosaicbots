// /api/serve-project.js
// Serves files from a complex multi-file project stored in Firebase Storage.
// Acts as a proxy so relative paths in index.html resolve correctly.
// Usage: /api/serve-project?root=projects/userId/botId&file=js/main.js

const BUCKET_BASE = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET || "mosaicbots.firebasestorage.app"}`;

const MIME_MAP = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  wasm: "application/wasm",
  txt: "text/plain",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { root, file = "index.html" } = req.query;
  if (!root) return res.status(400).json({ error: "Missing root param" });

  // Security: prevent path traversal
  const safePath = file.replace(/\.\.\//g, "").replace(/^\/+/, "");
  const storageUrl = `${BUCKET_BASE}/${root}/${safePath}`;

  let upstream;
  try {
    upstream = await fetch(storageUrl);
    if (!upstream.ok) {
      return res.status(upstream.status).send(`File not found: ${safePath}`);
    }
  } catch (e) {
    return res.status(502).json({ error: "Could not fetch file", detail: e.message });
  }

  const ext = safePath.split(".").pop().toLowerCase();
  const contentType = MIME_MAP[ext] || "application/octet-stream";

  // For HTML (index.html): inject Mosaic runtime + rewrite relative paths
  if (ext === "html" || ext === "htm") {
    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    let html = await upstream.text();

    // Remove any stale key injections
    html = html.replace(/<script[^>]*>\s*window\.ANTHROPIC_KEY[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<script[^>]*>\s*window\.__mosaicAI[\s\S]*?<\/script>/gi, "");

    // Rewrite relative asset paths to go through this proxy
    // This makes ./js/main.js -> /api/serve-project?root=...&file=js/main.js
    const encodedRoot = encodeURIComponent(root);
    const proxyBase = `/api/serve-project?root=${encodedRoot}&file=`;

    // Rewrite src and href attributes for relative paths
    html = html.replace(
      /(src|href)=["'](?!https?:\/\/|\/\/|data:|#|mailto:)([^"']+)["']/g,
      (match, attr, path) => {
        const cleanPath = path.replace(/^\.\//, "");
        return `${attr}="${proxyBase}${encodeURIComponent(cleanPath)}"`;
      }
    );

    // Also rewrite CSS url() references
    html = html.replace(
      /url\(['"]?(?!https?:\/\/|\/\/|data:)([^'")\s]+)['"]?\)/g,
      (match, path) => {
        const cleanPath = path.replace(/^\.\//, "");
        return `url("${proxyBase}${encodeURIComponent(cleanPath)}")`;
      }
    );

    // Inject Mosaic runtime
    const injected = `<script>
// Mosaic runtime injection — do not edit
window.ANTHROPIC_KEY = "${apiKey}";
window.__mosaicAI = async function(messages, system) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": window.ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-allow-browser": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6-20251101",
      max_tokens: 4096,
      system: system || "",
      messages
    })
  });
  const d = await r.json();
  if (d.error) { console.error("Mosaic AI error:", d.error); return ""; }
  return d.content?.[0]?.text || "";
};
// Mosaic project base path for dynamic imports
window.__mosaicProjectRoot = "${proxyBase}";
</script>`;

    const finalHtml = html.includes("</head>")
      ? html.replace("</head>", injected + "\n</head>")
      : injected + html;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(finalHtml);
  }

  // For all other files: stream through
  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).send(buffer);
}
