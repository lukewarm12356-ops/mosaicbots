// /api/run-app.js
// Fetches an app's HTML file server-side, injects the Anthropic API key,
// and returns the final HTML. Key never touches the browser directly.

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method not allowed");

  const { url, session } = req.query;
  // Never cache — always fetch fresh file from storage
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (!url) return res.status(400).json({ error: "Missing url param" });

  const apiKey = process.env.ANTHROPIC_API_KEY || "";

  let html;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
    html = await r.text();
  } catch (e) {
    return res.status(502).json({ error: "Could not fetch app file", detail: e.message });
  }

  // Remove any existing key/mosaicAI script blocks (stale placeholders)
  html = html.replace(/<script[^>]*>\s*window\.ANTHROPIC_KEY[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<script[^>]*>\s*window\.__mosaicAI[\s\S]*?<\/script>/gi, "");

  const injected = `<script>
// Mosaic runtime injection — do not edit
window.ANTHROPIC_KEY = "${apiKey}";
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBWbJ5n9ctU6z5mH2TjDmCPgdJpXv_HYxc",
  authDomain: "mosaicbots.firebaseapp.com",
  databaseURL: "https://mosaicbots-default-rtdb.firebaseio.com",
  projectId: "mosaicbots",
  storageBucket: "mosaicbots.appspot.com",
  messagingSenderId: "1070716635784",
  appId: "1:1070716635784:web:mosaicbots"
};
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
</script>`;

  // Inject Mosaic SDK for multiplayer if session param provided
  let mosaicSdk = "";
  if (session) {
    mosaicSdk = `<script type="module">
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
(function() {
  var app = initializeApp(window.FIREBASE_CONFIG);
  var db = getDatabase(app);
  var sid = ${JSON.stringify(session)};
  window.mosaicSet = function(key, value) { set(ref(db, 'sessions/' + sid + '/state/' + key), value); };
  window.mosaicOn = function(key, cb) { onValue(ref(db, 'sessions/' + sid + '/state/' + key), function(snap){ cb(snap.val()); }); };
})();
<\/script>`;
  }

  // Inject config into </head> (keys available immediately)
  // Inject SDK at end of </body> so DOM is ready for any init() calls
  let finalHtml = html;
  if (html.includes("</head>")) {
    finalHtml = finalHtml.replace("</head>", injected + "\n</head>");
  } else {
    finalHtml = injected + finalHtml;
  }
  if (mosaicSdk) {
    if (finalHtml.includes("</body>")) {
      finalHtml = finalHtml.replace("</body>", mosaicSdk + "\n</body>");
    } else {
      finalHtml = finalHtml + mosaicSdk;
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(finalHtml);
}
