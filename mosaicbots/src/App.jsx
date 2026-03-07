import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getDatabase, ref as dbRef, set as dbSet, onValue, off, serverTimestamp, onDisconnect, increment, get } from "firebase/database";

// ============================================================
// MOSAICBOTS — AI Bot Marketplace (Production Build)
// Firebase + Stripe Connect + Google Auth + Session Persistence
// ============================================================

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyBWbJ5n9ctU6z5mH2TjDmCPgdJpXv_HYxc",
  authDomain: "mosaicbots.firebaseapp.com",
  projectId: "mosaicbots",
  storageBucket: "mosaicbots.firebasestorage.app",
  messagingSenderId: "1070716635784",
  appId: "1:1070716635784:web:93954534a658faff1eed3d",
  databaseURL: "https://mosaicbots-default-rtdb.firebaseio.com"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const storage = getStorage(fbApp);
const auth = getAuth(fbApp);
const rtdb = getDatabase(fbApp);
const googleProvider = new GoogleAuthProvider();

// --- SESSION PERSISTENCE ---
const Session = {
  save(user) { try { localStorage.setItem("mb_session", JSON.stringify(user)); } catch {} },
  load() { try { const d = localStorage.getItem("mb_session"); return d ? JSON.parse(d) : null; } catch { return null; } },
  clear() { try { localStorage.removeItem("mb_session"); } catch {} },
};

// --- PERSISTENT STORAGE LAYER (Firebase Firestore) ---
const DB = {
  async getBots() {
    try {
      const snap = await getDocs(collection(db, "bots"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error("getBots:", e); return []; }
  },
  async saveBots(bots) {
    // Save each bot individually
    try {
      for (const bot of bots) {
        await setDoc(doc(db, "bots", bot.id), bot);
      }
    } catch (e) { console.error("saveBots:", e); }
  },
  async saveBot(bot) {
    try { await setDoc(doc(db, "bots", bot.id), bot); } catch (e) { console.error("saveBot:", e); }
  },
  async deleteBot(id) {
    try { await deleteDoc(doc(db, "bots", id)); } catch (e) { console.error("deleteBot:", e); }
  },
  async getUsers() {
    try {
      const snap = await getDocs(collection(db, "users"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error("getUsers:", e); return []; }
  },
  async saveUsers(users) {
    try {
      for (const user of users) {
        await setDoc(doc(db, "users", user.id), user);
      }
    } catch (e) { console.error("saveUsers:", e); }
  },
  async saveUser(user) {
    try { await setDoc(doc(db, "users", user.id), user); } catch (e) { console.error("saveUser:", e); }
  },
  async getAdmin() {
    try {
      const d = await getDoc(doc(db, "config", "admin"));
      return d.exists() ? d.data() : { email: "support@mosaicbots.com", platformFee: 15 };
    } catch { return { email: "support@mosaicbots.com", platformFee: 15 }; }
  },
  async saveAdmin(admin) {
    try { await setDoc(doc(db, "config", "admin"), admin); } catch (e) { console.error("saveAdmin:", e); }
  },
  async uploadFile(file, path) {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (e) { console.error("uploadFile:", e); return null; }
  },
  async getGroups() {
    try {
      const snap = await getDocs(query(collection(db, "groups"), orderBy("createdAt", "desc")));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error("getGroups:", e); return []; }
  },
  async saveGroup(group) {
    try { await setDoc(doc(db, "groups", group.id), group); } catch (e) { console.error("saveGroup:", e); }
  },
  async deleteGroup(id) {
    try { await deleteDoc(doc(db, "groups", id)); } catch (e) { console.error("deleteGroup:", e); }
  },
};

// --- CONSTANTS ---
const CATEGORIES = [
  "All", "Productivity", "Education", "Writing", "Creative",
  "Healthcare", "Finance", "E-Commerce", "Marketing",
  "Developer Tools", "Customer Support", "Entertainment", "Other"
];

const AI_PROVIDERS = [
  { id: "claude", name: "Anthropic Claude" },
  { id: "openai", name: "OpenAI" },
  { id: "google", name: "Google Gemini" },
  { id: "meta", name: "Meta Llama" },
  { id: "mistral", name: "Mistral AI" },
  { id: "custom", name: "Custom / Self-Hosted" },
];

const ADMIN_EMAIL = "lilly4834@icloud.com";
const ADMIN_EMAILS = ["lilly4834@icloud.com", "erikevan@icloud.com"];
const isAdmin = (user) => user && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase());

// --- STYLES ---
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  :root {
    /* Warm stone palette — South of France mosaic artist */
    --bg-0: #F5F3EF;
    --bg-1: #FDFCFA;
    --bg-2: #EDEAE4;
    --bg-3: #E4E0D8;
    --border: #DDD9D1;
    --border-h: #C8C2B8;
    --t1: #1C1917;
    --t2: #57534E;
    --t3: #A8A29E;
    --t4: #D6D3D1;

    /* Status */
    --ok: #059669; --ok-bg: #ECFDF5; --ok-border: #A7F3D0;
    --err: #DC2626; --err-bg: #FEF2F2; --err-border: #FECACA;
    --warn: #D97706; --warn-bg: #FFFBEB; --warn-border: #FDE68A;

    /* Accent — terracotta / warm indigo hybrid */
    --accent: #7C6FCD;
    --accent-2: #A89DE0;
    --accent-warm: #C07A5A;
    --accent-gold: #C9A84C;
    --accent-light: #F0EEFF;
    --accent-bg: rgba(124,111,205,0.06);

    /* Mosaic grout colours */
    --grout-1: #E8E4DC;
    --grout-2: #D4CEC4;
    --grout-3: #BFB8AC;
    --tile-shadow: 0 1px 0 rgba(255,255,255,0.85), 0 -1px 0 rgba(0,0,0,0.04);

    --r: 7px; --rl: 11px;
    --sans: 'DM Sans', -apple-system, sans-serif;
    --serif: 'DM Serif Display', Georgia, serif;
    --mono: 'DM Mono', monospace;
  }

  * { margin:0; padding:0; box-sizing:border-box; }
  html { scroll-behavior:smooth; }
  body {
    background: var(--bg-0);
    color: var(--t1);
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-size: 15px;
    line-height: 1.65;
  }
  ::selection { background: var(--accent); color: #fff; }
  input, textarea, select, button { font-family: var(--sans); color: var(--t1); }

  /* ─── ANIMATIONS ─────────────────────────────── */
  @keyframes fadeUp    { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideRight{ from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:translateX(0)} }
  @keyframes slideLeft { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }
  @keyframes scaleIn   { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
  @keyframes shimmer   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes tileFloat { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-7px) rotate(1.5deg)} }
  @keyframes tileFloat2{ 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-5px) rotate(-1deg)} }
  @keyframes spin      { to{transform:rotate(360deg)} }
  @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:0.5} }
  @keyframes groutLine { from{width:0;opacity:0} to{width:100%;opacity:1} }
  @keyframes tileReveal{ from{opacity:0;transform:scale(0.7) rotate(-5deg)} to{opacity:1;transform:scale(1) rotate(0deg)} }
  @keyframes drift    { 0%,100%{transform:translate(0,0) rotate(0deg)} 33%{transform:translate(6px,-8px) rotate(2deg)} 66%{transform:translate(-4px,5px) rotate(-1.5deg)} }
  @keyframes drift2   { 0%,100%{transform:translate(0,0) rotate(0deg)} 33%{transform:translate(-8px,5px) rotate(-2deg)} 66%{transform:translate(5px,-4px) rotate(1deg)} }
  @keyframes drift3   { 0%,100%{transform:translate(0,0) scale(1.0)} 50%{transform:translate(0,-12px) scale(1.04)} }
  @keyframes glowPulse{ 0%,100%{opacity:0.4} 50%{opacity:1} }

  /* ─── LOGO ──────────────────────────────────── */
  .logo-mark {
    width: 30px; height: 30px;
    background: var(--t1);
    border-radius: 8px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 2.5px;
    padding: 6px;
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .logo-mark:hover { transform: rotate(12deg) scale(1.1); }
  .logo-tile { border-radius: 1.5px; transition: opacity 0.2s; }

  /* ─── NAV ───────────────────────────────────── */
  .nav-item {
    position: relative;
    background: none;
    border: none;
    padding: 6px 13px;
    font-size: 13.5px;
    font-weight: 500;
    color: var(--t2);
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.18s;
    letter-spacing: -0.01em;
  }
  .nav-item:hover { color: var(--t1); background: var(--bg-2); }
  .nav-item.active { color: var(--t1); font-weight: 650; }
  .nav-item.active::after {
    content:'';
    position: absolute;
    bottom: -1px; left: 50%; transform: translateX(-50%);
    width: 16px; height: 2px;
    background: var(--t1);
    border-radius: 1px;
  }

  /* ─── CARDS ─────────────────────────────────── */
  .app-card {
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: var(--rl);
    cursor: pointer;
    transition: transform 0.28s cubic-bezier(0.23, 1, 0.32, 1),
                box-shadow 0.28s cubic-bezier(0.23, 1, 0.32, 1),
                border-color 0.2s;
    position: relative;
    overflow: hidden;
  }
  .app-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(124,111,205,0.04) 0%, rgba(192,122,90,0.03) 100%);
    opacity: 0;
    transition: opacity 0.28s;
    pointer-events: none;
    border-radius: inherit;
  }
  .app-card:hover {
    transform: translateY(-5px) scale(1.008);
    box-shadow: 0 16px 48px rgba(28,25,23,0.1), 0 4px 12px rgba(28,25,23,0.05);
    border-color: var(--border-h);
  }
  .app-card:hover::after { opacity: 1; }

  /* ─── FEATURED CARDS ────────────────────────── */
  .featured-card {
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: var(--rl);
    cursor: pointer;
    transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1),
                box-shadow 0.3s;
    position: relative;
    overflow: hidden;
  }
  .featured-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 2.5px;
    background: linear-gradient(90deg, var(--accent-warm), var(--accent), var(--accent-gold));
  }
  .featured-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 24px 60px rgba(28,25,23,0.12), 0 6px 18px rgba(28,25,23,0.06);
  }

  /* ─── MOSAIC GRID ───────────────────────────── */
  .mosaic-grid { display: grid; gap: 14px; }
  @media(min-width:640px) { .app-grid { grid-template-columns: 1fr 1fr !important; } }
  @media(min-width:900px) { .app-grid-3 { grid-template-columns: 1fr 1fr 1fr !important; } }

  /* ─── SECTION HEADERS ───────────────────────── */
  .section-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 18px;
  }
  .section-header::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--border), transparent);
  }

  /* ─── CATEGORY PILLS ────────────────────────── */
  .cat-pill {
    transition: all 0.18s cubic-bezier(0.23, 1, 0.32, 1);
    position: relative;
    white-space: nowrap;
    border-radius: 6px !important;
  }
  .cat-pill:hover { transform: translateY(-1px); }

  /* ─── STAT TILES ────────────────────────────── */
  .stat-tile {
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: var(--r);
    padding: 16px;
    transition: all 0.22s cubic-bezier(0.23, 1, 0.32, 1);
    box-shadow: var(--tile-shadow);
  }
  .stat-tile:hover {
    border-color: var(--border-h);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(28,25,23,0.07), var(--tile-shadow);
  }

  /* ─── TAGS ──────────────────────────────────── */
  .tag-chip {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    background: var(--bg-2);
    color: var(--t3);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    transition: all 0.15s;
    cursor: default;
  }
  .tag-chip:hover {
    background: var(--accent-light);
    border-color: rgba(124,111,205,0.25);
    color: var(--accent);
  }

  /* ─── PRIMARY BUTTON ────────────────────────── */
  .btn-primary-mosaic {
    background: var(--t1);
    color: #fff;
    border: none;
    border-radius: var(--r);
    font-family: var(--sans);
    font-weight: 600;
    cursor: pointer;
    letter-spacing: -0.01em;
    transition: all 0.22s cubic-bezier(0.23, 1, 0.32, 1);
    position: relative;
    overflow: hidden;
  }
  .btn-primary-mosaic::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%);
    opacity: 0;
    transition: opacity 0.2s;
  }
  .btn-primary-mosaic:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(28,25,23,0.25);
  }
  .btn-primary-mosaic:hover::before { opacity: 1; }
  .btn-primary-mosaic:active { transform: translateY(0); }

  /* ─── DETAIL HERO ───────────────────────────── */
  .detail-hero {
    position: relative;
    text-align: center;
    padding: 40px 28px 36px;
    background: linear-gradient(160deg, var(--bg-1) 0%, var(--bg-2) 100%);
    border: 1px solid var(--border);
    border-radius: var(--rl);
    margin-bottom: 20px;
    overflow: hidden;
  }
  .detail-hero::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent 0%, var(--accent-warm) 30%, var(--accent) 70%, transparent 100%);
  }

  /* ─── MOSAIC TILE DECORATIONS ───────────────── */
  .tile-accent {
    position: absolute;
    border-radius: 2px;
    pointer-events: none;
  }
  .deco-tile {
    position: absolute;
    border-radius: 5px;
    pointer-events: none;
  }

  /* ─── INPUTS ────────────────────────────────── */
  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px var(--accent-bg) !important;
  }

  /* ─── RESPONSIVE ────────────────────────────── */
  .mob-only { display: none !important; }
  .desk-only { display: initial; }
  @media(max-width:700px) {
    .mob-only { display: flex !important; }
    .desk-only { display: none !important; }
    .mob-pad { padding-left: 16px !important; padding-right: 16px !important; }
    .mob-col1 { grid-template-columns: 1fr !important; }
    .mob-stack { flex-direction: column !important; }
  }

  /* ─── MISC ──────────────────────────────────── */
  .nav-link { color:var(--t2); transition:color 0.15s; cursor:pointer; }
  .nav-link:hover { color:var(--t1); }
  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:var(--border-h); border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background:var(--t3); }
`;

// --- MICRO COMPONENTS ---
function Bdg({ children, v = "default", style: s }) {
  const m = { default: { background: "var(--bg-2)", color: "var(--t2)", border: "1px solid var(--border)" }, ok: { background: "var(--ok-bg)", color: "var(--ok)", border: "1px solid #BBF7D0" }, dark: { background: "var(--t1)", color: "#fff", border: "none" }, warn: { background: "var(--warn-bg)", color: "var(--warn)", border: "1px solid #FDE68A" }, err: { background: "var(--err-bg)", color: "var(--err)", border: "1px solid #FECACA" } };
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 100, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", ...m[v], ...s }}>{children}</span>;
}

function Btn({ children, v = "primary", sz = "md", onClick, style: s, disabled: d }) {
  const base = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontWeight: 600, cursor: d ? "not-allowed" : "pointer", border: "none", borderRadius: "var(--r)", transition: "all 0.2s cubic-bezier(0.23,1,0.32,1)", opacity: d ? 0.45 : 1, fontFamily: "var(--sans)", letterSpacing: "-0.01em", position: "relative" };
  const szs = { sm: { padding: "6px 14px", fontSize: 13 }, md: { padding: "9px 20px", fontSize: 14 }, lg: { padding: "13px 28px", fontSize: 15 } };
  const vs = {
    primary:   { background: "var(--t1)", color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" },
    secondary: { background: "var(--bg-2)", color: "var(--t1)", border: "1px solid var(--border-h)" },
    ghost:     { background: "transparent", color: "var(--t2)" },
    danger:    { background: "var(--err)", color: "#fff" },
    accent:    { background: "var(--accent)", color: "#fff", boxShadow: "0 2px 8px rgba(124,111,205,0.3)" },
  };
  const hover = (e, on) => {
    if (d) return;
    if (v === "primary") e.currentTarget.style.transform = on ? "translateY(-2px)" : "translateY(0)";
    if (v === "primary") e.currentTarget.style.boxShadow = on ? "0 6px 18px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.15)";
    if (v === "accent") e.currentTarget.style.transform = on ? "translateY(-2px)" : "translateY(0)";
    if (v === "secondary") e.currentTarget.style.borderColor = on ? "var(--border-h)" : "var(--border-h)";
    if (v === "secondary") e.currentTarget.style.background = on ? "var(--bg-3)" : "var(--bg-2)";
    if (v === "ghost") e.currentTarget.style.color = on ? "var(--t1)" : "var(--t2)";
  };
  return <button onClick={onClick} disabled={d} onMouseOver={e => hover(e,true)} onMouseOut={e => hover(e,false)} style={{ ...base, ...szs[sz], ...vs[v], ...s }}>{children}</button>;
}

function Field({ label, note, children, style: s }) {
  return <div style={s}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 5, letterSpacing: "0.01em" }}>{label}</label>{children}{note && <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{note}</p>}</div>;
}

function Inp({ ...p }) {
  return <input {...p} style={{ width: "100%", padding: "9px 13px", background: "var(--bg-1)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", color: "var(--t1)", fontSize: 14, outline: "none", ...p.style }}
    onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 3px var(--accent-bg)"; if (p.onFocus) p.onFocus(e); }}
    onBlur={e => { e.target.style.borderColor = "var(--border-h)"; e.target.style.boxShadow = "none"; if (p.onBlur) p.onBlur(e); }}
  />;
}

function Sel({ children, ...p }) {
  return <select {...p} style={{ width: "100%", padding: "9px 13px", background: "var(--bg-1)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", color: "var(--t1)", fontSize: 14, cursor: "pointer", ...p.style }}>{children}</select>;
}

function Divider() { return <div style={{ height: 1, background: "var(--border)" }} />; }

// --- CODE GENERATORS ---
function genPython(bot) {
  return `# ${bot.name} — Python Client\n# Mosaic | https://mosaicbots.com\n\nimport requests, os\n\nclass BotClient:\n    def __init__(self, api_key=None):\n        self.api_key = api_key or os.environ.get("MOSAICBOTS_API_KEY")\n        self.endpoint = "${bot.endpoint}"\n        self.session = None\n\n    def send(self, message, context=None):\n        r = requests.post(self.endpoint, json={\n            "message": message,\n            "session_id": self.session,\n            "context": context or {}\n        }, headers={\n            "Authorization": f"Bearer {self.api_key}",\n            "Content-Type": "application/json"\n        }, timeout=30)\n        r.raise_for_status()\n        data = r.json()\n        self.session = data.get("session_id")\n        return data\n\nif __name__ == "__main__":\n    bot = BotClient()\n    print(bot.send("Hello"))\n`;
}

function genNode(bot) {
  return `// ${bot.name} — Node.js Client\n// Mosaic | https://mosaicbots.com\n\nconst https = require('https');\nconst { URL } = require('url');\n\nclass BotClient {\n  constructor(apiKey) {\n    this.apiKey = apiKey || process.env.MOSAICBOTS_API_KEY;\n    this.endpoint = '${bot.endpoint}';\n    this.session = null;\n  }\n\n  async send(message, context = {}) {\n    const url = new URL(this.endpoint);\n    const body = JSON.stringify({ message, session_id: this.session, context });\n    return new Promise((resolve, reject) => {\n      const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST',\n        headers: { 'Authorization': 'Bearer ' + this.apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }\n      }, res => {\n        let d = ''; res.on('data', c => d += c);\n        res.on('end', () => { const p = JSON.parse(d); this.session = p.session_id; resolve(p); });\n      });\n      req.on('error', reject); req.write(body); req.end();\n    });\n  }\n}\n\nmodule.exports = { BotClient };\n`;
}

function genWidget(bot) {
  return `<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><title>${bot.name} Widget</title>\n<style>\n*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f5f5f4;display:flex;align-items:center;justify-content:center;min-height:100vh}\n.w{width:400px;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.08);overflow:hidden;display:flex;flex-direction:column;height:560px}\n.h{padding:18px 22px;border-bottom:1px solid #e7e5e4;font-weight:700;font-size:15px}\n.m{flex:1;overflow-y:auto;padding:18px 22px;display:flex;flex-direction:column;gap:10px}\n.msg{max-width:78%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5}\n.bot{background:#f5f5f4;align-self:flex-start;border-bottom-left-radius:4px}\n.usr{background:#1c1917;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}\n.inp{display:flex;gap:8px;padding:14px 22px;border-top:1px solid #e7e5e4}\n.inp input{flex:1;padding:9px 14px;border:1px solid #d6d3d1;border-radius:8px;font-size:14px;outline:none}\n.inp button{padding:9px 18px;background:#1c1917;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}\n</style></head><body>\n<div class="w"><div class="h">${bot.name}</div>\n<div class="m" id="m"><div class="msg bot">Hi, I'm ${bot.name}. How can I help?</div></div>\n<div class="inp"><input id="i" placeholder="Type a message..." onkeydown="if(event.key==='Enter')go()"><button onclick="go()">Send</button></div></div>\n<script>\nconst KEY='YOUR_API_KEY',EP='${bot.endpoint}';\nlet sid='s_'+Math.random().toString(36).slice(2);\nfunction add(t,u){const d=document.createElement('div');d.className='msg '+(u?'usr':'bot');d.textContent=t;document.getElementById('m').appendChild(d);d.parentElement.scrollTop=9e9}\nasync function go(){const i=document.getElementById('i'),t=i.value.trim();if(!t)return;i.value='';add(t,1);try{const r=await fetch(EP,{method:'POST',headers:{'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},body:JSON.stringify({message:t,session_id:sid})});const d=await r.json();if(d.session_id)sid=d.session_id;add(d.response||'Error',0)}catch{add('Connection error.',0)}}\n</script></body></html>`;
}

function dlFile(name, content) {
  const b = new Blob([content], { type: "text/plain" });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a"); a.href = u; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(u);
}

// --- AUTH MODAL (with forgot password) ---
function AuthModal({ isOpen, onClose, tab: initTab, users, setUsers, setCurrentUser }) {
  const [tab, setTab] = useState(initTab);
  const [f, sf] = useState({ email: "", password: "", name: "", company: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [verifyStep, setVerifyStep] = useState(false);
  const [code, setCode] = useState("");
  const [realCode] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [forgotStep, setForgotStep] = useState(0); // 0=none, 1=enter email, 2=enter code, 3=new password
  const [resetCode, setResetCode] = useState("");
  const [realResetCode] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [newPass, setNewPass] = useState("");
  const [termsOk, setTermsOk] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);

  useEffect(() => { setTab(initTab); setErr(""); setVerifyStep(false); setForgotStep(0); sf({ email: "", password: "", name: "", company: "" }); setCode(""); setResetCode(""); setNewPass(""); setTermsOk(false); setPrivacyOk(false); }, [initTab, isOpen]);
  if (!isOpen) return null;

  const handleSignUp = async () => {
    if (!f.name || !f.email || !f.password) { setErr("All fields are required."); return; }
    if (!termsOk || !privacyOk) { setErr("Please accept the Terms of Service and Privacy Policy to continue."); return; }
    if (f.password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (users.find(u => u.email === f.email)) { setErr("An account with this email already exists."); return; }
    setErr(""); setLoading(true);
    try {
      const res = await fetch("/api/send-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.email, code: realCode }) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Failed to send verification email. Try again."); setLoading(false); return; }
    } catch (e) { setErr("Failed to send verification email. Try again."); setLoading(false); return; }
    setLoading(false); setVerifyStep(true);
  };

  const handleVerify = async () => {
    if (code !== realCode) { setErr("Invalid code. Please try again."); return; }
    setLoading(true);
    const newUser = { id: "u_" + Date.now(), email: f.email, name: f.name, company: f.company, password: f.password, verified: true, createdAt: new Date().toISOString(), bio: "", avatarUrl: null, isPublic: true, followers: [], following: [] };
    const updated = [...users, newUser];
    setUsers(updated);
    await DB.saveUser(newUser);
    setCurrentUser(newUser);
    // Send welcome email (fire and forget)
    fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "welcome", to: f.email }) }).catch(() => {});
    setLoading(false);
    onClose();
  };

  const handleSignIn = async () => {
    const user = users.find(u => u.email.toLowerCase() === f.email.toLowerCase() && u.password === f.password);
    if (!user) { setErr("Invalid email or password."); return; }
    setCurrentUser(user);
    onClose();
  };

  const handleForgotSendCode = async () => {
    if (!f.email) { setErr("Enter your email address."); return; }
    const user = users.find(u => u.email.toLowerCase() === f.email.toLowerCase());
    if (!user) { setErr("No account found with that email."); return; }
    setErr(""); setLoading(true);
    try {
      const res = await fetch("/api/send-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.email, code: realResetCode }) });
      if (!res.ok) { setErr("Failed to send reset code. Try again."); setLoading(false); return; }
    } catch (e) { setErr("Failed to send reset code."); setLoading(false); return; }
    setLoading(false); setForgotStep(2);
  };

  const handleForgotVerify = () => {
    if (resetCode !== realResetCode) { setErr("Invalid code."); return; }
    setErr(""); setForgotStep(3);
  };

  const handleResetPassword = async () => {
    if (newPass.length < 8) { setErr("Password must be at least 8 characters."); return; }
    const user = users.find(u => u.email.toLowerCase() === f.email.toLowerCase());
    if (user) {
      user.password = newPass;
      await DB.saveUser(user);
      setUsers([...users]);
    }
    setErr(""); setForgotStep(0); setTab("signin");
    sf({ ...f, password: "" });
  };

  const handleGoogleSignIn = async () => {
    setLoading(true); setErr("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const gUser = result.user;
      // Check if user already exists in our DB
      let existing = users.find(u => u.email.toLowerCase() === gUser.email.toLowerCase());
      if (!existing) {
        // Create new user from Google account
        existing = {
          id: "u_" + Date.now(),
          email: gUser.email,
          name: gUser.displayName || gUser.email.split("@")[0],
          company: "",
          password: "",
          verified: true,
          googleUid: gUser.uid,
          photoURL: gUser.photoURL || null,
          avatarUrl: gUser.photoURL || null,
          bio: "",
          isPublic: true,
          followers: [],
          following: [],
          createdAt: new Date().toISOString(),
        };
        await DB.saveUser(existing);
        setUsers(prev => [...prev, existing]);
      }
      setCurrentUser(existing);
      setLoading(false);
      onClose();
    } catch (e) {
      console.error("Google sign-in error:", e);
      setErr(e.code === "auth/popup-closed-by-user" ? "" : "Google sign-in failed. Try again.");
      setLoading(false);
    }
  };

  const iStyle = { width: "100%", padding: "9px 13px", background: "var(--bg-1)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 14, color: "var(--t1)", outline: "none" };

  const getTitle = () => {
    if (forgotStep === 1) return "Reset password";
    if (forgotStep === 2) return "Enter reset code";
    if (forgotStep === 3) return "New password";
    if (verifyStep) return "Verify your email";
    return tab === "signin" ? "Sign in" : "Create account";
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", animation: "fadeIn 0.15s" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "var(--bg-1)", borderRadius: "var(--rl)", boxShadow: "0 20px 60px rgba(0,0,0,0.12)", animation: "slideDown 0.2s" }}>
        <div style={{ padding: "24px 24px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{getTitle()}</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 16, color: "var(--t3)", cursor: "pointer" }}>&#x2715;</button>
          </div>

          {/* FORGOT PASSWORD FLOW */}
          {forgotStep === 1 && <div style={{ paddingBottom: 24, display: "grid", gap: 12 }}>
            <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>Enter the email you signed up with and we'll send a reset code.</p>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", display: "block", marginBottom: 3 }}>Email</label><input style={iStyle} type="email" placeholder="you@company.com" value={f.email} onChange={e => sf({...f, email: e.target.value})} /></div>
            {err && <p style={{ fontSize: 12, color: "var(--err)" }}>{err}</p>}
            <Btn sz="lg" onClick={handleForgotSendCode} disabled={loading} style={{ width: "100%" }}>{loading ? "Sending..." : "Send Reset Code"}</Btn>
            <button onClick={() => { setForgotStep(0); setErr(""); }} style={{ background: "none", border: "none", fontSize: 12, color: "var(--t3)", cursor: "pointer", textAlign: "center" }}>Back to sign in</button>
          </div>}

          {forgotStep === 2 && <div style={{ paddingBottom: 24, display: "grid", gap: 12 }}>
            <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>We sent a code to <strong>{f.email}</strong>.</p>
            <input style={{ ...iStyle, textAlign: "center", fontSize: 20, fontFamily: "var(--mono)", letterSpacing: "0.2em" }} placeholder="000000" value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            {err && <p style={{ fontSize: 12, color: "var(--err)" }}>{err}</p>}
            <Btn sz="lg" onClick={handleForgotVerify} disabled={resetCode.length !== 6} style={{ width: "100%" }}>Verify Code</Btn>
          </div>}

          {forgotStep === 3 && <div style={{ paddingBottom: 24, display: "grid", gap: 12 }}>
            <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>Choose a new password for your account.</p>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", display: "block", marginBottom: 3 }}>New Password</label><input style={iStyle} type="password" placeholder="Min. 8 characters" value={newPass} onChange={e => setNewPass(e.target.value)} /></div>
            {err && <p style={{ fontSize: 12, color: "var(--err)" }}>{err}</p>}
            <Btn sz="lg" onClick={handleResetPassword} style={{ width: "100%" }}>Reset Password</Btn>
          </div>}

          {/* VERIFY EMAIL STEP */}
          {forgotStep === 0 && verifyStep && (
            <div style={{ paddingBottom: 24 }}>
              <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 16 }}>We sent a 6-digit code to <strong>{f.email}</strong>. Check your inbox and enter it below.</p>
              <input style={{ ...iStyle, textAlign: "center", fontSize: 20, fontFamily: "var(--mono)", letterSpacing: "0.2em", marginBottom: 12 }} placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              {err && <p style={{ fontSize: 12, color: "var(--err)", marginBottom: 8 }}>{err}</p>}
              <Btn sz="lg" onClick={handleVerify} disabled={loading || code.length !== 6} style={{ width: "100%" }}>{loading ? "Verifying..." : "Verify Email"}</Btn>
              <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 10, textAlign: "center" }}>Didn't get the email? Check spam or wait a moment.</p>
            </div>
          )}

          {/* SIGN IN / SIGN UP */}
          {forgotStep === 0 && !verifyStep && (
            <>
              <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
                {["signin", "signup"].map(t => <button key={t} onClick={() => { setTab(t); setErr(""); }} style={{ flex: 1, padding: "9px 0", background: "none", border: "none", borderBottom: tab === t ? "2px solid var(--t1)" : "2px solid transparent", color: tab === t ? "var(--t1)" : "var(--t3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t === "signin" ? "Sign In" : "Sign Up"}</button>)}
              </div>
              <div style={{ display: "grid", gap: 12, paddingBottom: 24 }}>
                {tab === "signup" && <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", display: "block", marginBottom: 3 }}>Full Name *</label><input style={iStyle} placeholder="Jane Doe" value={f.name} onChange={e => sf({...f, name: e.target.value})} /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", display: "block", marginBottom: 3 }}>Company</label><input style={iStyle} placeholder="Optional" value={f.company} onChange={e => sf({...f, company: e.target.value})} /></div>
                  </div>
                </>}
                <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", display: "block", marginBottom: 3 }}>Email *</label><input style={iStyle} type="email" placeholder="you@company.com" value={f.email} onChange={e => sf({...f, email: e.target.value})} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", display: "block", marginBottom: 3 }}>Password *</label><input style={iStyle} type="password" placeholder="Min. 8 characters" value={f.password} onChange={e => sf({...f, password: e.target.value})} /></div>
                {tab === "signin" && <button onClick={() => { setForgotStep(1); setErr(""); }} style={{ background: "none", border: "none", fontSize: 12, color: "#4F46E5", cursor: "pointer", textAlign: "right", fontWeight: 500 }}>Forgot password?</button>}
                {tab === "signup" && (
                  <div style={{ display:"grid", gap:8, padding:"12px 14px", background:"var(--bg-2)", borderRadius:"var(--r)", border:"1px solid var(--border)" }}>
                    <label style={{ display:"flex", alignItems:"flex-start", gap:9, cursor:"pointer" }}>
                      <input type="checkbox" checked={termsOk} onChange={e=>setTermsOk(e.target.checked)} style={{ accentColor:"var(--t1)", width:15, height:15, marginTop:1, flexShrink:0, cursor:"pointer" }} />
                      <span style={{ fontSize:12, color:"var(--t2)", lineHeight:1.5 }}>
                        I agree to the <button onClick={e=>{e.preventDefault();window.dispatchEvent(new CustomEvent("mosaicNav",{detail:"terms"}));}} style={{ background:"none", border:"none", padding:0, color:"var(--accent)", fontWeight:600, cursor:"pointer", fontSize:12 }}>Terms of Service</button>. I confirm I am 13 years or older, and 18+ to sell apps.
                      </span>
                    </label>
                    <label style={{ display:"flex", alignItems:"flex-start", gap:9, cursor:"pointer" }}>
                      <input type="checkbox" checked={privacyOk} onChange={e=>setPrivacyOk(e.target.checked)} style={{ accentColor:"var(--t1)", width:15, height:15, marginTop:1, flexShrink:0, cursor:"pointer" }} />
                      <span style={{ fontSize:12, color:"var(--t2)", lineHeight:1.5 }}>
                        I have read and accept the <button onClick={e=>{e.preventDefault();window.dispatchEvent(new CustomEvent("mosaicNav",{detail:"privacy"}));}} style={{ background:"none", border:"none", padding:0, color:"var(--accent)", fontWeight:600, cursor:"pointer", fontSize:12 }}>Privacy Policy</button> and consent to the collection of my data as described.
                      </span>
                    </label>
                  </div>
                )}
                {err && <p style={{ fontSize: 12, color: "var(--err)" }}>{err}</p>}
                <Btn sz="lg" onClick={tab === "signin" ? handleSignIn : handleSignUp} disabled={loading || (tab === "signup" && (!termsOk || !privacyOk))} style={{ width: "100%", marginTop: 4, opacity: tab === "signup" && (!termsOk || !privacyOk) ? 0.5 : 1 }}>{loading ? "Sending code..." : tab === "signin" ? "Sign In" : "Create Account"}</Btn>
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  <span style={{ fontSize: 11, color: "var(--t3)" }}>or</span>
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                </div>
                <button onClick={handleGoogleSignIn} disabled={loading} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "10px 16px", background: "var(--bg-0)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 14, fontWeight: 500, cursor: "pointer", color: "var(--t1)", transition: "all 0.15s" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Continue with Google
                </button>
              </div>
            </>
          )}
        </div>
        <div style={{ background: "var(--bg-2)", padding: "11px 24px", fontSize: 11, color: "var(--t3)", textAlign: "center" }}>
          {tab === "signin" ? "By signing in, you confirm you have previously accepted our Terms & Privacy Policy." : "Your data is encrypted and never sold to third parties."}
        </div>
      </div>
    </div>
  );
}

// --- DOWNLOAD MODAL ---
function DlModal({ isOpen, onClose, bot }) {
  if (!isOpen || !bot) return null;
  const pkgs = [
    { id: "py", name: "Python Client", file: `${bot.id}_client.py`, desc: "Ready-to-use class with session management", gen: () => genPython(bot) },
    { id: "node", name: "Node.js Client", file: `${bot.id}_client.js`, desc: "Zero-dependency async module", gen: () => genNode(bot) },
    { id: "html", name: "HTML Chat Widget", file: `${bot.id}_widget.html`, desc: "Standalone styled chat interface", gen: () => genWidget(bot) },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", animation: "fadeIn 0.15s" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--bg-1)", borderRadius: "var(--rl)", boxShadow: "0 20px 60px rgba(0,0,0,0.12)", padding: 24, animation: "slideDown 0.2s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Download {bot.name}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 16, color: "var(--t3)", cursor: "pointer" }}>&#x2715;</button>
        </div>
        <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>Choose an integration package. Replace YOUR_API_KEY after subscribing.</p>
        <div style={{ display: "grid", gap: 8 }}>
          {pkgs.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "var(--bg-0)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
              <div><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{p.name}</div><div style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>{p.file}</div></div>
              <Btn v="secondary" sz="sm" onClick={() => dlFile(p.file, p.gen())}>Download</Btn>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- NAVBAR ---
function Nav({ onNav, view, user, onAuth, onSignOut }) {
  const [sideOpen, setSideOpen] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  const navItems = [
    { id: "home", l: "Explore" },
    { id: "groups", l: "Groups" },
    { id: "submit", l: "Create" },
    ...(user ? [{ id: "myapps", l: "My Apps" }, { id: "dashboard", l: "Dashboard" }] : []),
    ...(isAdmin(user) ? [{ id: "admin", l: "Admin" }] : []),
  ];

  // Mosaic tile icon helper
  const MosaicTile = ({ color, sz = 28, gap = 2.5, pad = 6 }) => (
    <div style={{ width: sz, height: sz, borderRadius: 8, background: color || "var(--t1)", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap, padding: pad, flexShrink: 0 }}>
      <div style={{ borderRadius: "1.5px", background: "rgba(255,255,255,0.9)" }} />
      <div style={{ borderRadius: "1.5px", background: "rgba(255,255,255,0.4)" }} />
      <div style={{ borderRadius: "1.5px", background: "rgba(255,255,255,0.4)" }} />
      <div style={{ borderRadius: "1.5px", background: "rgba(255,255,255,0.9)" }} />
    </div>
  );

  return (
    <>
      {/* ── TOP BAR ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(245,243,239,0.94)", backdropFilter: "blur(24px) saturate(1.6)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", height: 56, padding: "0 18px", gap: 8 }}>

          {/* Hamburger — mobile only */}
          <button className="mob-only" onClick={() => setSideOpen(true)} style={{ background: "none", border: "none", width: 36, height: 36, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer", borderRadius: 8, flexShrink: 0, transition: "background 0.15s" }}
            onMouseOver={e => e.currentTarget.style.background = "var(--bg-2)"} onMouseOut={e => e.currentTarget.style.background = "none"}>
            <span style={{ width: 17, height: 1.5, background: "var(--t1)", borderRadius: 1, display: "block" }} />
            <span style={{ width: 12, height: 1.5, background: "var(--t2)", borderRadius: 1, display: "block" }} />
          </button>

          {/* Logo */}
          <div onClick={() => { onNav("home"); setSideOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", marginRight: 14, flexShrink: 0 }}>
            <div className="logo-mark">
              <div className="logo-tile" style={{ background: "rgba(255,255,255,0.92)" }} />
              <div className="logo-tile" style={{ background: "rgba(255,255,255,0.4)" }} />
              <div className="logo-tile" style={{ background: "rgba(255,255,255,0.4)" }} />
              <div className="logo-tile" style={{ background: "rgba(255,255,255,0.92)" }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.03em", fontFamily: "var(--serif)" }}>Mosaic</span>
          </div>

          {/* Desktop inline nav links */}
          <div className="desk-only" style={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
            {navItems.map(item => (
              <button key={item.id} className={`nav-item${view === item.id ? " active" : ""}`} onClick={() => onNav(item.id)}>{item.l}</button>
            ))}
          </div>

          {/* Right: auth */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            {user ? (
              <button onClick={() => onNav("profile")} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "1px solid var(--border-h)", borderRadius: 100, padding: "4px 13px 4px 5px", cursor: "pointer", transition: "all 0.18s" }}
                onMouseOver={e => e.currentTarget.style.borderColor = "var(--accent)"} onMouseOut={e => e.currentTarget.style.borderColor = "var(--border-h)"}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{(user.name||"?")[0].toUpperCase()}</div>
                <span className="desk-only" style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", letterSpacing: "-0.01em" }}>{user.name.split(" ")[0]}</span>
              </button>
            ) : (
              <>
                <Btn v="ghost" sz="sm" onClick={() => onAuth("signin")}>Sign In</Btn>
                <Btn sz="sm" onClick={() => onAuth("signup")}>Get Started</Btn>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── SIGN OUT CONFIRM ── */}
      {signOutConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(28,25,23,0.45)", backdropFilter: "blur(8px)", animation: "fadeIn 0.15s" }} onClick={() => setSignOutConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-1)", borderRadius: "var(--rl)", padding: "30px 26px", maxWidth: 340, width: "90%", textAlign: "center", animation: "scaleIn 0.2s" }}>
            <h3 style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 400, marginBottom: 8 }}>Sign out?</h3>
            <p style={{ fontSize: 14, color: "var(--t2)", marginBottom: 22, lineHeight: 1.55 }}>You'll need to sign back in to access your dashboard and apps.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Btn v="secondary" sz="md" onClick={() => setSignOutConfirm(false)}>Cancel</Btn>
              <Btn v="danger" sz="md" onClick={() => { setSignOutConfirm(false); onSignOut(); }}>Sign Out</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR OVERLAY ── */}
      {sideOpen && <div onClick={() => setSideOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,0.3)", zIndex: 200, animation: "fadeIn 0.18s", backdropFilter: "blur(2px)" }} />}

      {/* ── SIDEBAR ── */}
      <div style={{ position: "fixed", top: 0, left: sideOpen ? 0 : -285, width: 275, height: "100vh", background: "var(--bg-1)", zIndex: 201, transition: "left 0.28s cubic-bezier(0.23,1,0.32,1)", boxShadow: sideOpen ? "6px 0 32px rgba(28,25,23,0.1)" : "none", display: "flex", flexDirection: "column" }}>

        {/* Sidebar header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div className="logo-mark">
              <div className="logo-tile" style={{ background: "rgba(255,255,255,0.92)" }} />
              <div className="logo-tile" style={{ background: "rgba(255,255,255,0.4)" }} />
              <div className="logo-tile" style={{ background: "rgba(255,255,255,0.4)" }} />
              <div className="logo-tile" style={{ background: "rgba(255,255,255,0.92)" }} />
            </div>
            <span style={{ fontSize: 15.5, fontWeight: 700, fontFamily: "var(--serif)", letterSpacing: "-0.025em" }}>Mosaic</span>
          </div>
          <button onClick={() => setSideOpen(false)} style={{ background: "none", border: "none", width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--t3)", fontSize: 16, transition: "all 0.15s" }}
            onMouseOver={e => { e.currentTarget.style.background = "var(--bg-2)"; e.currentTarget.style.color = "var(--t1)"; }} onMouseOut={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--t3)"; }}>✕</button>
        </div>

        {/* User mini-card in sidebar */}
        {user && (
          <div style={{ margin: "12px 14px 0", padding: "12px 14px", background: "var(--bg-0)", borderRadius: 10, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{(user.name||"?")[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</p>
              <p style={{ fontSize: 11, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
            </div>
          </div>
        )}

        {/* Nav items */}
        <div style={{ padding: "12px 10px", flex: 1 }}>
          {[...navItems, ...(user ? [{ id: "profile", l: "Profile" }] : [])].map((item, idx) => (
            <div key={item.id} onClick={() => { onNav(item.id); setSideOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, cursor: "pointer", background: view === item.id ? "var(--accent-light)" : "transparent", color: view === item.id ? "var(--accent)" : "var(--t2)", fontWeight: view === item.id ? 600 : 450, fontSize: 14, transition: "all 0.14s", marginBottom: 2, animation: sideOpen ? `slideRight 0.22s ease ${idx * 0.04}s both` : "none" }}
              onMouseOver={e => { if (view !== item.id) { e.currentTarget.style.background = "var(--bg-2)"; e.currentTarget.style.color = "var(--t1)"; } }}
              onMouseOut={e => { if (view !== item.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--t2)"; } }}>
              <div style={{ width: 6, height: 6, borderRadius: 1.5, background: view === item.id ? "var(--accent)" : "var(--border-h)", flexShrink: 0, transition: "all 0.2s" }} />
              {item.l}
            </div>
          ))}
        </div>

        {/* Sidebar footer */}
        <div style={{ padding: "14px 18px 20px", borderTop: "1px solid var(--border)" }}>
          {user ? (
            <button onClick={() => { setSideOpen(false); setSignOutConfirm(true); }} style={{ width: "100%", padding: "9px", background: "none", border: "1px solid var(--border)", borderRadius: 9, fontSize: 13, color: "var(--t3)", cursor: "pointer", fontFamily: "var(--sans)", transition: "all 0.15s", marginBottom: 10 }}
              onMouseOver={e => { e.currentTarget.style.borderColor = "var(--err)"; e.currentTarget.style.color = "var(--err)"; }} onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--t3)"; }}>Sign Out</button>
          ) : (
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <Btn v="secondary" sz="sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { onAuth("signin"); setSideOpen(false); }}>Sign In</Btn>
              <Btn sz="sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { onAuth("signup"); setSideOpen(false); }}>Sign Up</Btn>
            </div>
          )}
          <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
            {[{ id: "about", l: "About" }, { id: "contact", l: "Contact" }, { id: "privacy", l: "Privacy" }, { id: "terms", l: "Terms" }].map(i => (
              <span key={i.id} onClick={() => { onNav(i.id); setSideOpen(false); }} style={{ fontSize: 11.5, color: "var(--t3)", cursor: "pointer", padding: "3px 8px 3px 0", transition: "color 0.15s" }}
                onMouseOver={e => e.currentTarget.style.color = "var(--t1)"} onMouseOut={e => e.currentTarget.style.color = "var(--t3)"}>{i.l}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// --- HOME PAGE (App Store) ---
function HomePage({ bots, search, setSearch, cat, setCat, onBotClick }) {
  const approved = bots.filter(b => b.status === "approved" && b.visibility !== "private");
  const filtered = approved.filter(b => {
    const q = search.toLowerCase();
    const ms = !q || b.name.toLowerCase().includes(q) || b.tagline.toLowerCase().includes(q) || (b.tags || "").toLowerCase().includes(q);
    const mc = cat === "All" || b.category === cat;
    return ms && mc;
  });
  const featured = approved.filter(b => b.featured);
  const popular = [...approved].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 6);

  const [liveCounts, setLiveCounts] = useState({});

  useEffect(() => {
    const liveBots = approved.filter(b => b.sessionType === "live");
    const listeners = liveBots.map(bot => {
      const r = dbRef(rtdb, `sessions/${bot.id}/count`);
      const unsub = onValue(r, snap => {
        setLiveCounts(prev => ({ ...prev, [bot.id]: snap.val() || 0 }));
      });
      return () => off(r, 'value', unsub);
    });
    return () => listeners.forEach(u => u());
  }, [approved.length]);

  const SessionBadge = ({ bot }) => {
    if (bot.sessionType === "live") return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 100, fontSize: 10, fontWeight: 600, color: "var(--ok)" }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--ok)", animation: "pulse 1.5s ease-in-out infinite" }} />
        {liveCounts[bot.id] > 0 ? `${liveCounts[bot.id]} live` : "Live"}
      </div>
    );
    if (bot.sessionType === "shared") return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: "rgba(124,111,205,0.1)", border: "1px solid rgba(124,111,205,0.25)", borderRadius: 100, fontSize: 10, fontWeight: 600, color: "var(--accent)" }}>
        🔗 Shared
      </div>
    );
    return null;
  };

  const AppCard = ({ bot, i }) => (
    <div className="app-card" onClick={()=>onBotClick(bot)} style={{ padding:"16px 18px", animation:`fadeUp 0.35s ease ${(i||0)*0.04}s both` }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:13 }}>
        {bot.iconUrl
          ? <img src={bot.iconUrl} alt={bot.name} style={{ width:52, height:52, borderRadius:9, objectFit:"cover", flexShrink:0, boxShadow:"0 1px 6px rgba(0,0,0,0.1)" }} />
          : <div style={{ width:52, height:52, borderRadius:9, background:bot.accentColor||"var(--t1)", display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"1fr 1fr", gap:"3px", padding:"9px", flexShrink:0 }}>
              <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.95)" }} />
              <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.38)" }} />
              <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.38)" }} />
              <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.95)" }} />
            </div>}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:3 }}>
            <h3 style={{ fontSize:14, fontWeight:700, letterSpacing:"-0.02em", lineHeight:1.2 }}>{bot.name}</h3>
            <span style={{ padding:"3px 9px", background:bot.price>0?"var(--t1)":"var(--bg-2)", color:bot.price>0?"#fff":"var(--ok)", borderRadius:5, fontSize:11, fontWeight:700, flexShrink:0, border:bot.price>0?"none":"1px solid rgba(16,185,129,0.2)" }}>{bot.price>0?"$"+bot.price+"/mo":"Free"}</span>
          </div>
          <p style={{ fontSize:10, color:"var(--t3)", marginBottom:5, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>{bot.category}</p>
          <p style={{ fontSize:13, color:"var(--t2)", lineHeight:1.5, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{bot.tagline}</p>
          {bot.sessionType==="live" && <div style={{ marginTop:6, display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", background:"rgba(16,185,129,0.07)", border:"1px solid rgba(16,185,129,0.18)", borderRadius:4, fontSize:9, fontWeight:700, color:"var(--ok)", letterSpacing:"0.07em" }}><div style={{ width:4, height:4, borderRadius:"50%", background:"var(--ok)", animation:"pulse 2s ease-in-out infinite" }} />MULTIPLAYER</div>}
        </div>
      </div>
    </div>
  );

  return <>
    {/* ── HERO ── */}
    <section style={{ position: "relative", overflow: "hidden", minHeight: "clamp(480px,58vw,600px)", background: "#0F0E0B" }}>
      {/* Background photo — subtle slow drift */}
      <div style={{ position: "absolute", inset: "-8%", background: "url(https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=1800&q=90) center 40%/cover", animation: "drift3 22s ease-in-out infinite" }} />
      {/* Gradient layers */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(15,14,11,0.18) 0%, rgba(15,14,11,0.58) 55%, rgba(15,14,11,0.92) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 65% 25%, rgba(124,111,205,0.1) 0%, transparent 55%)" }} />

      {/* Floating mosaic tiles — top right */}
      <div style={{ position: "absolute", top: 28, right: 36, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, opacity: 0.38 }}>
        {[
          {c:"rgba(201,168,76,0.9)",  a:"drift 10s ease-in-out infinite"},
          {c:"rgba(255,255,255,0.5)", a:"drift2 13s ease-in-out 0.4s infinite"},
          {c:"rgba(192,122,90,0.85)", a:"drift 15s ease-in-out 1.1s infinite"},
          {c:"rgba(255,255,255,0.32)",a:"drift2  9s ease-in-out 2.2s infinite"},
          {c:"rgba(201,168,76,0.55)", a:"drift 12s ease-in-out 0.6s infinite"},
          {c:"rgba(255,255,255,0.48)",a:"drift2 11s ease-in-out 1.7s infinite"},
          {c:"rgba(192,122,90,0.7)",  a:"drift 14s ease-in-out 0.9s infinite"},
          {c:"rgba(255,255,255,0.38)",a:"drift2 10s ease-in-out 2.8s infinite"},
          {c:"rgba(201,168,76,0.8)",  a:"drift 13s ease-in-out 1.4s infinite"},
        ].map((t,i) => (
          <div key={i} style={{ width:36, height:36, borderRadius:4, background:t.c, animation:`tileReveal 0.5s ease ${i*0.07}s both, ${t.a}` }} />
        ))}
      </div>

      {/* Mosaic dot grid — bottom left */}
      <div style={{ position:"absolute", bottom:44, left:36, display:"grid", gridTemplateColumns:"repeat(5,10px)", gap:4, opacity:0.22 }}>
        {[.9,.3,.7,.2,.6,.5,.9,.3,.8,.4,.7,.2,.9,.5,.8,.3,.8,.4,.9,.3,.6,.4,.7,.2,.9].map((o,i)=>(
          <div key={i} style={{ height:10, borderRadius:2, background:"#fff", opacity:o, animation:`fadeIn 0.3s ease ${i*0.025}s both` }} />
        ))}
      </div>

      {/* Bottom accent line */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:1.5, background:"linear-gradient(90deg, transparent 0%, rgba(124,111,205,0.5) 35%, rgba(201,168,76,0.5) 65%, transparent 100%)", animation:"glowPulse 5s ease-in-out infinite" }} />

      {/* Content */}
      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", minHeight:"clamp(480px,58vw,600px)", padding:"40px 24px 72px", textAlign:"center" }}>

        {/* Eyebrow */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, animation:"fadeUp 0.5s ease both" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2.5, padding:"5px", background:"rgba(255,255,255,0.07)", borderRadius:5 }}>
            <div style={{ width:5, height:5, borderRadius:1, background:"rgba(201,168,76,0.9)" }} />
            <div style={{ width:5, height:5, borderRadius:1, background:"rgba(255,255,255,0.35)" }} />
            <div style={{ width:5, height:5, borderRadius:1, background:"rgba(255,255,255,0.35)" }} />
            <div style={{ width:5, height:5, borderRadius:1, background:"rgba(201,168,76,0.9)" }} />
          </div>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.22em", textTransform:"uppercase", color:"rgba(255,255,255,0.4)" }}>Mosaic — The AI App Marketplace</span>
        </div>

        <h1 style={{ fontFamily:"var(--serif)", fontWeight:400, lineHeight:1.05, letterSpacing:"-0.025em", marginBottom:20, color:"#fff", animation:"fadeUp 0.6s ease 0.08s both" }}>
          <span style={{ fontSize:"clamp(38px,6.5vw,66px)", display:"block" }}>Build, Buy, Sell &amp; Discover</span>
          <em style={{ fontStyle:"italic", color:"rgba(255,255,255,0.65)", fontSize:"clamp(22px,3.5vw,38px)", display:"block", marginTop:4 }}>production-ready AI tools</em>
        </h1>

        <p style={{ fontSize:"clamp(14px,1.8vw,16px)", color:"rgba(255,255,255,0.55)", lineHeight:1.7, maxWidth:400, marginBottom:36, animation:"fadeUp 0.6s ease 0.16s both", fontWeight:300, letterSpacing:"0.01em" }}>
          The marketplace where builders deploy AI tools and users discover what AI can actually do.
        </p>

        {/* Search bar */}
        <div style={{ position:"relative", maxWidth:460, width:"100%", animation:"fadeUp 0.6s ease 0.24s both" }}>
          <svg style={{ position:"absolute", left:18, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/>
            <path d="M11 11l3.5 3.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search apps, tools, agents..."
            style={{ width:"100%", padding:"14px 20px 14px 48px", background:"rgba(255,255,255,0.08)", backdropFilter:"blur(32px)", border:"1px solid rgba(255,255,255,0.14)", borderRadius:9, fontSize:15, color:"#fff", outline:"none", fontFamily:"var(--sans)", fontWeight:400, letterSpacing:"0.01em", transition:"all 0.2s", boxSizing:"border-box" }}
            onFocus={e=>{ e.target.style.borderColor="rgba(124,111,205,0.5)"; e.target.style.background="rgba(255,255,255,0.11)"; e.target.style.boxShadow="0 0 0 3px rgba(124,111,205,0.12)"; }}
            onBlur={e=>{ e.target.style.borderColor="rgba(255,255,255,0.14)"; e.target.style.background="rgba(255,255,255,0.08)"; e.target.style.boxShadow="none"; }}
          />
        </div>

        {/* Trust row */}
        <div style={{ display:"flex", alignItems:"center", gap:0, marginTop:26, animation:"fadeUp 0.6s ease 0.32s both" }}>
          {[{n:"Free to browse"},{n:"Verified creators"},{n:"Stripe-powered"}].map((b,i)=>(
            <div key={b.n} style={{ display:"flex", alignItems:"center", gap:8 }}>
              {i>0 && <span style={{ width:1, height:11, background:"rgba(255,255,255,0.15)", display:"inline-block", margin:"0 16px" }} />}
              <div style={{ width:4, height:4, borderRadius:1, background:"rgba(201,168,76,0.65)" }} />
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)", fontWeight:500, letterSpacing:"0.04em" }}>{b.n}</span>
            </div>
          ))}
        </div>
      </div>
    </section>

    <div className="mob-pad" style={{ maxWidth: 920, margin: "0 auto", padding: "40px 24px 90px" }}>

      {/* MULTIPLAYER — only for apps built as multi-user experiences */}
      {approved.filter(b => b.sessionType === "live").length > 0 && !search && cat === "All" && (
        <div style={{ marginBottom: 40 }}>
          <div className="section-header">
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"1fr 1fr", gap:2, width:14, height:14 }}>
                <div style={{ borderRadius:"1px", background:"var(--accent)" }} />
                <div style={{ borderRadius:"1px", background:"var(--accent-2)", opacity:0.5 }} />
                <div style={{ borderRadius:"1px", background:"var(--accent-2)", opacity:0.5 }} />
                <div style={{ borderRadius:"1px", background:"var(--accent)" }} />
              </div>
              <h2 style={{ fontFamily:"var(--serif)", fontSize:20, fontWeight:500, letterSpacing:"-0.02em" }}>Multiplayer</h2>
            </div>
            <p style={{ fontSize:12, color:"var(--t3)", marginLeft:12 }}>Real-time group experiences</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px,1fr))", gap:10 }}>
            {approved.filter(b => b.sessionType === "live").map((bot,i) => (
              <div key={bot.id} onClick={()=>onBotClick(bot)} className="app-card" style={{ padding:"15px 17px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  {bot.iconUrl
                    ? <img src={bot.iconUrl} alt={bot.name} style={{ width:42, height:42, borderRadius:8, objectFit:"cover", flexShrink:0 }} />
                    : <div style={{ width:42, height:42, borderRadius:8, background:bot.accentColor||"var(--t1)", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px", padding:"7px", flexShrink:0 }}>
                        <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.95)" }} /><div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.4)" }} />
                        <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.4)" }} /><div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.95)" }} />
                      </div>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2 }}>
                      <span style={{ fontSize:14, fontWeight:700, letterSpacing:"-0.01em" }}>{bot.name}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:3, padding:"2px 8px", background:"rgba(16,185,129,0.07)", border:"1px solid rgba(16,185,129,0.18)", borderRadius:4, fontSize:9, fontWeight:700, color:"var(--ok)", letterSpacing:"0.07em" }}>
                        <div style={{ width:4, height:4, borderRadius:"50%", background:"var(--ok)", animation:"pulse 2s ease-in-out infinite" }} />
                        {liveCounts[bot.id]>0 ? `${liveCounts[bot.id]} ONLINE` : "LIVE"}
                      </div>
                    </div>
                    <p style={{ fontSize:12, color:"var(--t3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bot.tagline}</p>
                  </div>
                  <span style={{ fontSize:12, color:"var(--t2)", fontWeight:600, flexShrink:0, letterSpacing:"-0.01em" }}>Join</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CATEGORIES */}
      <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 6, marginBottom: 32, scrollbarWidth: "none" }}>
        <style>{`.cat-scroll::-webkit-scrollbar{display:none}`}</style>
        {CATEGORIES.map((c, idx) => (
          <button key={c} className="cat-pill" onClick={() => setCat(c)}
            style={{ padding: "7px 18px", background: cat === c ? "var(--t1)" : "var(--bg-1)", color: cat === c ? "#fff" : "var(--t2)", border: `1px solid ${cat === c ? "transparent" : "var(--border)"}`, borderRadius: 100, fontSize: 12.5, fontWeight: cat === c ? 600 : 450, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, boxShadow: cat === c ? "0 3px 10px rgba(28,25,23,0.18)" : "var(--tile-shadow)", animation: `fadeUp 0.3s ease ${idx * 0.025}s both` }}>
            {c}
          </button>
        ))}
      </div>

      {/* FEATURED */}
      {featured.length > 0 && !search && cat === "All" && <div style={{ marginBottom: 32 }}>
        <div className="section-header">
          <span style={{ display: "inline-flex", gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: 1.5, background: "var(--accent)", display: "inline-block" }} />
            <span style={{ width: 6, height: 6, borderRadius: 1.5, background: "var(--accent-2)", display: "inline-block", opacity: 0.6 }} />
          </span>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 500, letterSpacing: "-0.02em" }}>Featured</h2>
        </div>
        <div className="mosaic-grid app-grid">{featured.map((b, i) => <AppCard key={b.id} bot={b} i={i} />)}</div>
      </div>}

      {/* ALL APPS */}
      <div className="section-header">
        <span style={{ display: "inline-flex", gap: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: 1.5, background: "var(--accent-warm)", display: "inline-block" }} />
          <span style={{ width: 6, height: 6, borderRadius: 1.5, background: "var(--mosaic-3)", display: "inline-block", opacity: 0.8 }} />
        </span>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 500, letterSpacing: "-0.02em" }}>{cat === "All" && !search ? "All Apps" : search ? "Results" : cat}</h2>
      </div>
      {filtered.length > 0 ? (
        <div className="mosaic-grid app-grid">
          {filtered.map((bot, i) => <AppCard key={bot.id} bot={bot} i={i} />)}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}><svg width="20" height="20" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="var(--t3)" strokeWidth="1.5"/><path d="M11 11l3.5 3.5" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{approved.length === 0 ? "No apps yet" : "No results"}</p>
          <p style={{ fontSize: 14, color: "var(--t3)" }}>{approved.length === 0 ? "Be the first to share an AI tool." : "Try different keywords."}</p>
        </div>
      )}
    </div>
  </>;
}

// --- BOT DETAIL (Pure App Store) ---
function BotDetailPage({ bot, onBack, onDownload, onAuth, user, onOpenApp, onViewProfile, users }) {
  const [buying, setBuying] = useState(false);
  const [getState, setGetState] = useState(null); // null, "loading", "done"

  const isSubscribed = (() => {
    if (!user) return false;
    try { const subs = JSON.parse(localStorage.getItem("mb_subs_" + user.id) || "[]"); return subs.includes(bot.id); } catch { return false; }
  })();

  const handleGet = async () => {
    if (!user) { onAuth("signup"); return; }
    if (bot.price === 0 || !bot.price) {
      setGetState("loading");
      // Simulate a brief loading experience
      await new Promise(r => setTimeout(r, 1500));
      try {
        const subs = JSON.parse(localStorage.getItem("mb_subs_" + user.id) || "[]");
        if (!subs.includes(bot.id)) { subs.push(bot.id); localStorage.setItem("mb_subs_" + user.id, JSON.stringify(subs)); }
      } catch {}
      setGetState("done");
      return;
    }
    setBuying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: bot.id, botName: bot.name, price: bot.price, buyerEmail: user.email, creatorStripeAccount: bot.creatorStripeAccount || null, pricingModel: "subscription" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { alert("Error: " + (data.error || "Could not create checkout")); setBuying(false); }
    } catch (e) { alert("Error connecting to payment system."); setBuying(false); }
  };

  const creatorUser = (users || []).find(u => u.id === bot.creatorId);
  const displayCreator = creatorUser?.showCreatorName === false ? "Anonymous" : bot.creatorName;

  return (
    <div className="mob-pad" style={{ maxWidth: 620, margin: "0 auto", padding: "24px 20px 80px", animation: "fadeIn 0.2s" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--t3)", fontSize: 13, cursor: "pointer", fontWeight: 500, marginBottom: 24, display: "flex", alignItems: "center", gap: 5, letterSpacing: "0.01em" }}><span style={{ fontSize: 16, lineHeight: 1 }}>&larr;</span> Back</button>

      <div className="detail-hero">
        {/* Decorative mosaic corner tiles */}
        <div style={{ position: "absolute", bottom: 16, right: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, opacity: 0.12 }}>
          {[...Array(9)].map((_, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: 1.5, background: "var(--accent)" }} />)}
        </div>
        {bot.iconUrl ? (
          <img src={bot.iconUrl} alt={bot.name} style={{ width: 88, height: 88, borderRadius: 22, objectFit: "cover", margin: "0 auto 16px", display: "block", boxShadow: "0 8px 28px rgba(0,0,0,0.12)" }} />
        ) : (
          <div style={{ width: 88, height: 88, borderRadius: 22, background: bot.accentColor || "var(--t1)", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "4px", padding: "14px", margin: "0 auto 16px", boxShadow: "0 8px 28px rgba(0,0,0,0.15)" }}>
            <div style={{ borderRadius: "3px", background: "rgba(255,255,255,0.95)" }} />
            <div style={{ borderRadius: "3px", background: "rgba(255,255,255,0.45)" }} />
            <div style={{ borderRadius: "3px", background: "rgba(255,255,255,0.45)" }} />
            <div style={{ borderRadius: "3px", background: "rgba(255,255,255,0.95)" }} />
          </div>
        )}
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.025em", marginBottom: 5 }}>{bot.name}</h1>
        <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 10, fontWeight: 500, letterSpacing: "0.03em", textTransform: "uppercase", fontSize: 11 }}>{displayCreator} &middot; {bot.category}</p>
        <p style={{ fontSize: 15, color: "var(--t2)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 24px" }}>{bot.tagline}</p>

        {/* SCREENSHOTS */}
        {bot.screenshotUrls && bot.screenshotUrls.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 0 14px", marginBottom: 10, WebkitOverflowScrolling: "touch" }}>
            {bot.screenshotUrls.map((url, i) => (
              <img key={i} src={url} style={{ height: 160, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
            ))}
          </div>
        )}

        {getState === "loading" ? (
          <div style={{ padding: "16px 0" }}>
            <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 10px" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t2)" }}>Installing...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : getState === "done" ? (
          <div style={{ padding: "12px 0" }}>
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--ok-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", border: "1px solid rgba(16,185,129,0.2)" }}><span style={{ color: "var(--ok)", fontSize: 20 }}>&#10003;</span></div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ok)", marginBottom: 4 }}>Installed!</p>
            <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 14 }}>Check your apps to open it</p>
            <Btn sz="md" onClick={() => onOpenApp && onOpenApp(bot)}>Open Now</Btn>
          </div>
        ) : isSubscribed ? (
          <button className="btn-primary-mosaic" onClick={() => onOpenApp && onOpenApp(bot)} style={{ padding: "13px 32px", fontSize: 15, borderRadius: "var(--r)", minWidth: 180 }}>Open App</button>
        ) : (
          <button className="btn-primary-mosaic" onClick={handleGet} style={{ padding: "13px 32px", fontSize: 15, borderRadius: "var(--r)", minWidth: 200, opacity: buying ? 0.7 : 1 }}>{buying ? "Loading..." : bot.price > 0 ? "Get — $" + bot.price + "/mo" : "Get — Free"}</button>
        )}
        {bot.price > 0 && !isSubscribed && !getState && <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 10 }}>Cancel anytime</p>}
        {isSubscribed && !getState && <p style={{ fontSize: 11, color: "var(--ok)", marginTop: 10, fontWeight: 600 }}>&#10003; Installed</p>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
        {[
          { l: "Price", v: bot.price > 0 ? "$" + bot.price + "/mo" : "Free" },
          { l: "Category", v: bot.category },
          { l: "Provider", v: bot.aiProvider || "AI" },
        ].map(s => (
          <div key={s.l} className="stat-tile">
            <p style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{s.l}</p>
            <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>{s.v}</p>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 28, padding: "22px 24px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)" }}>
        <div className="section-header" style={{ marginBottom: 12 }}>
          <span style={{ display: "inline-flex", gap: 3 }}>
            <span style={{ width: 5, height: 5, borderRadius: 1, background: "var(--accent)", display: "inline-block" }} />
            <span style={{ width: 5, height: 5, borderRadius: 1, background: "var(--accent-warm)", display: "inline-block", opacity: 0.7 }} />
          </span>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 500 }}>About</h3>
        </div>
        <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{bot.description}</p>
      </div>

      {bot.tags && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 28 }}>{bot.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => <span key={t} className="tag-chip">{t}</span>)}</div>}

      <ReviewSection botId={bot.id} user={user} onAuth={onAuth} />
    </div>
  );
}

// --- SUBMIT PAGE ---
function SubmitPage({ user, onAuth, bots, setBots }) {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [stepErrors, setStepErrors] = useState({});
  const [f, sf] = useState({
    name: "", tagline: "", description: "", category: "", endpoint: "", price: "", website: "",
    aiProvider: "", tags: "", accentColor: "#1C1917", pricingModel: "subscription", visibility: "public",
    useCase: "", targetAudience: "", keyFeatures: "", limitations: "", supportEmail: "",
    sessionType: "solo"
  });
  const [anthropicKey, setAnthropicKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [botFile, setBotFile] = useState(null);
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const set = k => e => sf(prev => ({ ...prev, [k]: e.target.value }));

  // Image crop state
  const [cropModal, setCropModal] = useState(null); // { src, type, index, aspectRatio }
  const [cropPos, setCropPos] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const cropCanvasRef = useRef(null);
  const cropImgRef = useRef(null);

  const openCrop = (src, type, index = null) => {
    setCropModal({ src, type, index });
    setCropPos({ x: 0, y: 0, scale: 1 });
  };

  const closeCrop = () => setCropModal(null);

  const applyCrop = () => {
    const canvas = cropCanvasRef.current;
    const img = cropImgRef.current;
    if (!canvas || !img) return;
    const size = cropModal.type === "icon" ? 400 : 800;
    const h = cropModal.type === "icon" ? 400 : 500;
    canvas.width = size;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, h);
    if (cropModal.type === "icon") {
      ctx.beginPath();
      ctx.roundRect(0, 0, size, h, size * 0.22);
      ctx.clip();
    }
    const displayW = 280, displayH = cropModal.type === "icon" ? 280 : 175;
    const scaleX = size / displayW, scaleY = h / displayH;
    const imgW = img.naturalWidth, imgH = img.naturalHeight;
    const baseScale = Math.max(displayW / imgW, displayH / imgH);
    const totalScale = baseScale * cropPos.scale;
    const drawW = imgW * totalScale * scaleX;
    const drawH = imgH * totalScale * scaleY;
    const drawX = (size / 2) + cropPos.x * scaleX - drawW / 2;
    const drawY = (h / 2) + cropPos.y * scaleY - drawH / 2;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    canvas.toBlob(blob => {
      const file = new File([blob], `image_${Date.now()}.png`, { type: "image/png" });
      const url = URL.createObjectURL(blob);
      if (cropModal.type === "icon") {
        setIconFile(file);
        setIconPreview(url);
      } else {
        if (cropModal.index !== null) {
          setScreenshotPreviews(prev => prev.map((p, i) => i === cropModal.index ? url : p));
          setScreenshots(prev => prev.map((s, i) => i === cropModal.index ? file : s));
        } else {
          setScreenshots(prev => [...prev, file].slice(0, 5));
          setScreenshotPreviews(prev => [...prev, url].slice(0, 5));
        }
      }
      closeCrop();
    }, "image/png", 0.95);
  };

  const handleIconChange = (e) => {
    const file = e.target.files[0];
    if (file) { const r = new FileReader(); r.onload = ev => openCrop(ev.target.result, "icon"); r.readAsDataURL(file); }
  };
  const handleScreenshots = (e) => {
    const files = Array.from(e.target.files).slice(0, 5 - screenshotPreviews.length);
    files.forEach(file => { const r = new FileReader(); r.onload = ev => openCrop(ev.target.result, "screenshot", null); r.readAsDataURL(file); });
  };
  const removeScreenshot = (idx) => {
    setScreenshots(prev => prev.filter((_, i) => i !== idx));
    setScreenshotPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  // Crop Modal Component
  const CropModal = () => {
    if (!cropModal) return null;
    const isIcon = cropModal.type === "icon";
    const displayW = 280, displayH = isIcon ? 280 : 175;
    const baseImg = new window.Image();
    baseImg.src = cropModal.src;
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "var(--bg-0)", border: "1px solid var(--border)", borderRadius: "var(--rl)", padding: 24, width: "100%", maxWidth: 380, animation: "fadeUp 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700 }}>Adjust {isIcon ? "Icon" : "Screenshot"}</p>
            <button onClick={closeCrop} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--t3)", lineHeight: 1 }}>&times;</button>
          </div>

          {/* Preview area */}
          <div style={{ position: "relative", width: displayW, height: displayH, margin: "0 auto 16px", overflow: "hidden", borderRadius: isIcon ? "22%" : 12, border: "1px solid var(--border)", background: "#111", cursor: dragging ? "grabbing" : "grab", userSelect: "none" }}
            onMouseDown={e => { setDragging(true); setDragStart({ x: e.clientX - cropPos.x, y: e.clientY - cropPos.y }); }}
            onMouseMove={e => { if (!dragging) return; setCropPos(p => ({ ...p, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })); }}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            onTouchStart={e => { const t = e.touches[0]; setDragging(true); setDragStart({ x: t.clientX - cropPos.x, y: t.clientY - cropPos.y }); }}
            onTouchMove={e => { if (!dragging) return; const t = e.touches[0]; setCropPos(p => ({ ...p, x: t.clientX - dragStart.x, y: t.clientY - dragStart.y })); }}
            onTouchEnd={() => setDragging(false)}
          >
            <img ref={cropImgRef} src={cropModal.src} style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(calc(-50% + ${cropPos.x}px), calc(-50% + ${cropPos.y}px)) scale(${cropPos.scale})`, transformOrigin: "center", maxWidth: "none", userSelect: "none", pointerEvents: "none" }} draggable={false} />
          </div>

          {/* Zoom slider */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>ZOOM</p>
              <p style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>{Math.round(cropPos.scale * 100)}%</p>
            </div>
            <input type="range" min="50" max="300" value={Math.round(cropPos.scale * 100)}
              onChange={e => setCropPos(p => ({ ...p, scale: Number(e.target.value) / 100 }))}
              style={{ width: "100%", accentColor: "var(--accent)" }} />
          </div>

          <p style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", marginBottom: 14 }}>Drag to reposition · Scroll to zoom</p>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={closeCrop} style={{ flex: 1, padding: "10px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 13, cursor: "pointer", color: "var(--t2)", fontWeight: 600 }}>Cancel</button>
            <button onClick={applyCrop} style={{ flex: 2, padding: "10px", background: "var(--t1)", border: "none", borderRadius: "var(--r)", fontSize: 13, cursor: "pointer", color: "#fff", fontWeight: 700 }}>Apply</button>
          </div>
          <canvas ref={cropCanvasRef} style={{ display: "none" }} />
        </div>
      </div>
    );
  };

  // Validation per step
  const validateStep = (s) => {
    const errs = {};
    if (s === 1) {
      if (!f.name.trim()) errs.name = "App name is required";
      if (!f.category) errs.category = "Category is required";
      if (!f.tagline.trim()) errs.tagline = "Tagline is required";
      if (!f.description.trim() || f.description.trim().length < 50) errs.description = "Description must be at least 50 characters";
      if (!f.useCase.trim()) errs.useCase = "Use case is required";
      if (!f.targetAudience.trim()) errs.targetAudience = "Target audience is required";
      if (!f.keyFeatures.trim()) errs.keyFeatures = "Key features are required";
    }
    if (s === 2) {
      if (!f.aiProvider) errs.aiProvider = "AI provider is required";
      if (!f.tags.trim()) errs.tags = "At least one tag is required";
      if (!f.supportEmail.trim()) errs.supportEmail = "Support email is required";
    }
    if (s === 3) {
      if (!iconFile && !f.accentColor) errs.icon = "Upload an icon or choose a brand color";
    }
    return errs;
  };

  const tryNext = (nextStep) => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setStepErrors(errs); return; }
    setStepErrors({});
    setStep(nextStep);
  };

  const ErrMsg = ({ field }) => stepErrors[field] ? <p style={{ fontSize: 11, color: "var(--err)", marginTop: 4, fontWeight: 500 }}>{stepErrors[field]}</p> : null;

  if (!user) return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: "80px 28px", textAlign: "center" }}>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 500, marginBottom: 8 }}>Sign in to create</h2>
      <p style={{ fontSize: 14, color: "var(--t2)", marginBottom: 20 }}>You need an account to share AI tools on Mosaic.</p>
      <Btn onClick={() => onAuth("signup")}>Create Account</Btn>
    </div>
  );

  if (submitted) return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: "80px 28px", textAlign: "center", animation: "fadeUp 0.3s" }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: "var(--ok-bg)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, padding: 10, margin: "0 auto 20px" }}>
        <div style={{ borderRadius: 2, background: "var(--ok)", opacity: 0.9 }} /><div style={{ borderRadius: 2, background: "var(--ok)", opacity: 0.5 }} />
        <div style={{ borderRadius: 2, background: "var(--ok)", opacity: 0.5 }} /><div style={{ borderRadius: 2, background: "var(--ok)", opacity: 0.9 }} />
      </div>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 500, marginBottom: 8 }}>{f.visibility === "private" ? "Private app created" : "Submitted for review"}</h2>
      <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.6 }}>{f.visibility === "private" ? "Your private app is live. Share the code below." : "The Mosaic team will review your submission within 48 hours."}</p>
      {f.visibility === "private" && f.shareCode && (
        <div style={{ marginTop: 16, padding: "14px 20px", background: "var(--bg-2)", borderRadius: "var(--r)", display: "inline-block" }}>
          <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>Share Code</p>
          <p style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "0.1em" }}>{f.shareCode}</p>
        </div>
      )}
    </div>
  );

  const handleFileChange = (e) => { const file = e.target.files[0]; if (file) setBotFile(file); };

  const doSubmit = async () => {
    setUploading(true);
    let fileUrl = null, iconUrl = null, screenshotUrls = [];

    // If HTML file + Anthropic key provided, inject key then wipe it
    let processedFile = botFile;
    if (botFile && anthropicKey.trim()) {
      try {
        const html = await botFile.text();
        const injected = html
          .replace(/YOUR_ANTHROPIC_KEY|sk-ant-XXXXXX|ANTHROPIC_API_KEY_HERE/g, anthropicKey.trim())
          .replace(/(['"`])__MOSAIC_API_KEY__\1/g, `'${anthropicKey.trim()}'`);
        // Build a backend proxy snippet and inject before </body>
        const proxySnippet = `\n<script>\n// Mosaic API proxy — key injected at submission, do not edit\nwindow.__mosaicAI = async function(messages, system) {\n  const r = await fetch('https://api.anthropic.com/v1/messages', {\n    method: 'POST',\n    headers: {\n      'content-type': 'application/json',\n      'x-api-key': '${anthropicKey.trim()}',\n      'anthropic-version': '2023-06-01',\n      'anthropic-dangerous-allow-browser': 'true'\n    },\n    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: system || '', messages })\n  });\n  const d = await r.json();\n  return d.content?.[0]?.text || '';\n};\n<\/script>`;
        const finalHtml = injected.includes('</body>') 
          ? injected.replace('</body>', proxySnippet + '\n</body>')
          : injected + proxySnippet;
        processedFile = new File([finalHtml], botFile.name, { type: 'text/html' });
      } catch(e) { console.error('Key injection failed', e); }
      // Wipe key from memory immediately
      setAnthropicKey("");
    }

    if (processedFile) { const path = `bots/${user.id}/${Date.now()}_${processedFile.name}`; fileUrl = await DB.uploadFile(processedFile, path); }
    if (iconFile) { const path = `icons/${user.id}/${Date.now()}_${iconFile.name}`; iconUrl = await DB.uploadFile(iconFile, path); }
    for (let i = 0; i < screenshots.length; i++) {
      const path = `screenshots/${user.id}/${Date.now()}_${i}_${screenshots[i].name}`;
      const url = await DB.uploadFile(screenshots[i], path);
      if (url) screenshotUrls.push(url);
    }
    const shareCode = f.visibility === "private" ? Math.random().toString(36).slice(2, 10).toUpperCase() : null;
    sf(prev => ({ ...prev, shareCode }));
    const newBot = {
      id: "bot_" + Date.now(), ...f, price: Number(f.price) || 0, pricingModel: f.pricingModel || "subscription",
      creatorName: user.name, creatorId: user.id, creatorEmail: user.email,
      status: f.visibility === "private" ? "approved" : "pending", featured: false, createdAt: new Date().toISOString(),
      downloads: 0, revenue: 0, fileUrl: fileUrl || null, fileName: botFile?.name || null,
      iconUrl: iconUrl || null, screenshotUrls, visibility: f.visibility || "public", shareCode,
      sessionType: f.sessionType || "solo", liveCount: 0, subscribers: 0,
    };
    setBots(prev => [...prev, newBot]);
    await DB.saveBot(newBot);
    setUploading(false);
    setSubmitted(true);
  };

  // Section header component
  const SectionHead = ({ n, title, subtitle }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--t1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{n}</div>
      <div><p style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</p><p style={{ fontSize: 12, color: "var(--t3)", marginTop: 1 }}>{subtitle}</p></div>
    </div>
  );

  // Step progress dots
  const steps = [
    { n: 1, label: "Details" },
    { n: 2, label: "Tech" },
    { n: 3, label: "Media" },
    { n: 4, label: "Review" },
  ];

  return (
    <div className="mob-pad" style={{ maxWidth: 660, margin: "0 auto", padding: "44px 20px 80px", animation: "fadeUp 0.3s" }}>
      <CropModal />
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--t3)", marginBottom: 10 }}>Create</p>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 500, marginBottom: 6 }}>Share your AI tool</h1>
      <p style={{ fontSize: 14, color: "var(--t2)", marginBottom: 24 }}>You keep 85% of every sale. Free to list — we handle billing and distribution.</p>

      {/* Step progress */}
      <div style={{ display: "flex", gap: 0, marginBottom: 32, background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", overflow: "hidden" }}>
        {steps.map((s, i) => (
          <div key={s.n} style={{ flex: 1, padding: "10px 8px", textAlign: "center", background: step === s.n ? "var(--t1)" : step > s.n ? "var(--accent-light)" : "transparent", borderRight: i < 3 ? "1px solid var(--border)" : "none", transition: "all 0.2s" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: step === s.n ? "#fff" : step > s.n ? "var(--accent)" : "var(--t3)" }}>{s.n}</p>
            <p style={{ fontSize: 10, color: step === s.n ? "rgba(255,255,255,0.7)" : step > s.n ? "var(--accent)" : "var(--t3)", marginTop: 1 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* STEP 1: App Details */}
      {step === 1 && (
        <div style={{ display: "grid", gap: 20 }}>
          <SectionHead n="A" title="Basic Information" subtitle="Required — this is what users see first" />
          <div className="mob-grid1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Field label="App Name *"><Inp placeholder="e.g. GlowBot" value={f.name} onChange={set("name")} style={stepErrors.name ? { borderColor: "var(--err)" } : {}} /></Field>
              <ErrMsg field="name" />
            </div>
            <div>
              <Field label="Category *"><Sel value={f.category} onChange={set("category")} style={stepErrors.category ? { borderColor: "var(--err)" } : {}}><option value="">Select category</option>{CATEGORIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}</Sel></Field>
              <ErrMsg field="category" />
            </div>
          </div>
          <div>
            <Field label="Tagline *" note="One punchy sentence — appears on the card in the marketplace"><Inp placeholder="e.g. AI receptionist for medical spas — handles bookings 24/7" value={f.tagline} onChange={set("tagline")} style={stepErrors.tagline ? { borderColor: "var(--err)" } : {}} /></Field>
            <ErrMsg field="tagline" />
          </div>
          <div>
            <Field label="Full Description *" note="Minimum 50 characters. Explain what it does, how it works, what makes it special.">
              <textarea style={{ width: "100%", padding: "10px 13px", background: "var(--bg-1)", border: `1px solid ${stepErrors.description ? "var(--err)" : "var(--border-h)"}`, borderRadius: "var(--r)", fontSize: 14, minHeight: 120, resize: "vertical", outline: "none", color: "var(--t1)", lineHeight: 1.6, fontFamily: "var(--sans)" }} placeholder="Describe your app in detail. What problem does it solve? How does it work? Who is it for?" value={f.description} onChange={set("description")} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <p style={{ fontSize: 11, color: f.description.length < 50 ? "var(--warn)" : "var(--ok)" }}>{f.description.length} / 50 min characters</p>
              </div>
            </Field>
            <ErrMsg field="description" />
          </div>

          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <SectionHead n="B" title="Listing Details" subtitle="Required — helps users understand if this is right for them" />

          <div>
            <Field label="Primary Use Case *" note="e.g. Customer support automation, Study assistance, Content generation">
              <Inp placeholder="What is this app primarily used for?" value={f.useCase} onChange={set("useCase")} style={stepErrors.useCase ? { borderColor: "var(--err)" } : {}} />
            </Field>
            <ErrMsg field="useCase" />
          </div>
          <div>
            <Field label="Target Audience *" note="e.g. Medical spa owners, College students, Small business owners">
              <Inp placeholder="Who is this app built for?" value={f.targetAudience} onChange={set("targetAudience")} style={stepErrors.targetAudience ? { borderColor: "var(--err)" } : {}} />
            </Field>
            <ErrMsg field="targetAudience" />
          </div>
          <div>
            <Field label="Key Features *" note="List the 3–5 most important things your app does">
              <textarea style={{ width: "100%", padding: "10px 13px", background: "var(--bg-1)", border: `1px solid ${stepErrors.keyFeatures ? "var(--err)" : "var(--border-h)"}`, borderRadius: "var(--r)", fontSize: 14, minHeight: 80, resize: "vertical", outline: "none", color: "var(--t1)", lineHeight: 1.6, fontFamily: "var(--sans)" }} placeholder="• 24/7 availability&#10;• Learns from your website&#10;• Embeddable chat widget" value={f.keyFeatures} onChange={set("keyFeatures")} />
            </Field>
            <ErrMsg field="keyFeatures" />
          </div>
          <Field label="Known Limitations" note="Optional but builds trust — what can't this app do?">
            <textarea style={{ width: "100%", padding: "10px 13px", background: "var(--bg-1)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 14, minHeight: 60, resize: "vertical", outline: "none", color: "var(--t1)", lineHeight: 1.6, fontFamily: "var(--sans)" }} placeholder="e.g. Cannot process payments, only works in English" value={f.limitations} onChange={set("limitations")} />
          </Field>

          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <SectionHead n="C" title="Pricing & Visibility" subtitle="Required — how you want to sell this app" />

          <div className="mob-grid1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Monthly Price (USD)" note="Set to 0 for free"><Inp type="number" placeholder="0" value={f.price} onChange={set("price")} /></Field>
            <Field label="Website URL" note="Optional — your product's homepage"><Inp type="url" placeholder="https://yourapp.com" value={f.website} onChange={set("website")} /></Field>
          </div>
          <Field label="Visibility">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{ id: "public", l: "Public", d: "Listed on the marketplace" }, { id: "private", l: "Private", d: "Only via share code" }].map(v => (
                <div key={v.id} onClick={() => sf(prev => ({ ...prev, visibility: v.id }))} style={{ padding: "12px 14px", background: f.visibility === v.id ? "var(--t1)" : "var(--bg-1)", color: f.visibility === v.id ? "#fff" : "var(--t2)", border: `1px solid ${f.visibility === v.id ? "var(--t1)" : "var(--border-h)"}`, borderRadius: "var(--r)", cursor: "pointer", transition: "all 0.15s" }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{v.l}</p>
                  <p style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{v.d}</p>
                </div>
              ))}
            </div>
          </Field>

          <Field label="Session Type" note="How users experience your app — shown as a badge on your listing">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { id: "solo", l: "Solo", i: "◉", d: "One user at a time — tools, assistants, generators" },
                { id: "shared", l: "Private Shared", i: "◈", d: "Invite others into your session via link" },
                { id: "live", l: "Always Live", i: "●", d: "Multiple users simultaneously — games, debates, group AI" },
              ].map(v => (
                <div key={v.id} onClick={() => sf(prev => ({ ...prev, sessionType: v.id }))} style={{ padding: "12px 10px", background: f.sessionType === v.id ? "var(--t1)" : "var(--bg-1)", color: f.sessionType === v.id ? "#fff" : "var(--t2)", border: `1px solid ${f.sessionType === v.id ? "var(--t1)" : "var(--border-h)"}`, borderRadius: "var(--r)", cursor: "pointer", transition: "all 0.15s", textAlign: "center" }}>
                  <div style={{ fontSize: 16, marginBottom: 4, color: v.id === "live" && f.sessionType === v.id ? "#10B981" : "inherit" }}>{v.i}</div>
                  <p style={{ fontSize: 12, fontWeight: 700 }}>{v.l}</p>
                  <p style={{ fontSize: 10, opacity: 0.65, marginTop: 2, lineHeight: 1.3 }}>{v.d}</p>
                </div>
              ))}
            </div>
            {(f.sessionType === "live" || f.sessionType === "shared") && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "var(--r)" }}>
                <p style={{ fontSize: 12, color: "var(--ok)", fontWeight: 600 }}>
                  {f.sessionType === "live" ? "Always Live apps get a real-time user count badge and appear in the Live Now section on the homepage." : "Private Shared apps let users invite others into the same session via a share link."}
                </p>
                <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>Mosaic automatically injects mosaicSet() and mosaicOn() into your app — use them to sync state between users. No Firebase setup needed.</p>
              </div>
            )}
          </Field>

          {Object.keys(stepErrors).length > 0 && (
            <div style={{ padding: "12px 16px", background: "var(--err-bg)", border: "1px solid #FECACA", borderRadius: "var(--r)" }}>
              <p style={{ fontSize: 13, color: "var(--err)", fontWeight: 600 }}>Please fill in all required fields before continuing.</p>
            </div>
          )}
          <button className="btn-primary-mosaic" onClick={() => tryNext(2)} style={{ padding: "13px 24px", fontSize: 15, borderRadius: "var(--r)", width: "100%" }}>Continue to Technical Details →</button>
        </div>
      )}

      {/* STEP 2: Technical */}
      {step === 2 && (
        <div style={{ display: "grid", gap: 20 }}>
          <SectionHead n="D" title="Technical Information" subtitle="Required — how your app is built" />

          <div>
            <Field label="AI Provider *" note="Which AI model powers your app?">
              <div className="mob-grid2" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {AI_PROVIDERS.map(p => (
                  <div key={p.id} onClick={() => sf(prev => ({ ...prev, aiProvider: p.name }))} style={{ padding: "10px 8px", background: f.aiProvider === p.name ? "var(--t1)" : "var(--bg-1)", color: f.aiProvider === p.name ? "#fff" : "var(--t2)", border: `1px solid ${f.aiProvider === p.name ? "var(--t1)" : stepErrors.aiProvider ? "var(--err)" : "var(--border-h)"}`, borderRadius: "var(--r)", cursor: "pointer", fontSize: 11, fontWeight: 600, textAlign: "center", transition: "all 0.15s" }}>{p.name}</div>
                ))}
              </div>
            </Field>
            <ErrMsg field="aiProvider" />
          </div>

          <Field label="API Endpoint URL" note="Optional — the endpoint users will call to interact with your bot">
            <Inp type="url" placeholder="https://yourapi.com/chat" value={f.endpoint} onChange={set("endpoint")} />
          </Field>

          {/* API KEY INJECTOR */}
          <div style={{ padding: "18px 20px", background: "linear-gradient(135deg, rgba(124,111,205,0.06), rgba(124,111,205,0.02))", border: "1px solid rgba(124,111,205,0.2)", borderRadius: "var(--rl)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Anthropic API Key — Optional</p>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", background: "rgba(16,185,129,0.1)", color: "var(--ok)", borderRadius: 100, border: "1px solid rgba(16,185,129,0.2)" }}>AUTO-INJECT</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.6, marginBottom: 14 }}>Paste your Anthropic API key and Mosaic will automatically inject it into your app file so Claude works instantly — no coding needed. Your key is used once during upload then permanently deleted from our system.</p>
            <div style={{ position: "relative" }}>
              <input
                type={showKey ? "text" : "password"}
                placeholder="sk-ant-api03-..."
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                style={{ width: "100%", padding: "10px 44px 10px 14px", background: "var(--bg-0)", border: "1px solid rgba(124,111,205,0.3)", borderRadius: "var(--r)", fontSize: 13, outline: "none", color: "var(--t1)", fontFamily: "var(--mono)", letterSpacing: anthropicKey && !showKey ? "0.1em" : "normal", boxSizing: "border-box" }}
              />
              <button onClick={() => setShowKey(p => !p)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--t3)", padding: "4px 6px" }}>
                {showKey ? "hide" : "show"}
              </button>
            </div>
            {anthropicKey && anthropicKey.startsWith("sk-ant") && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                <span style={{ color: "var(--ok)", fontSize: 13 }}>✓</span>
                <p style={{ fontSize: 12, color: "var(--ok)", fontWeight: 600 }}>Key detected — will be injected into your app on submit and then deleted</p>
              </div>
            )}
            {anthropicKey && !anthropicKey.startsWith("sk-ant") && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                <span style={{ color: "var(--warn)", fontSize: 13 }}>⚠</span>
                <p style={{ fontSize: 12, color: "var(--warn)" }}>This doesn't look like an Anthropic key — they start with sk-ant</p>
              </div>
            )}
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 10, lineHeight: 1.5 }}>Don't have a key? Get one free at <a href="https://console.anthropic.com" target="_blank" rel="noopener" style={{ color: "var(--accent)", textDecoration: "none" }}>console.anthropic.com</a> — takes 2 minutes.</p>
          </div>

          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <SectionHead n="E" title="Discovery & Support" subtitle="Required — helps people find and trust your app" />

          <div>
            <Field label="Tags *" note="Comma-separated keywords — how people will search for your app">
              <Inp placeholder="e.g. medical spa, booking, HIPAA, customer service" value={f.tags} onChange={set("tags")} style={stepErrors.tags ? { borderColor: "var(--err)" } : {}} />
            </Field>
            <ErrMsg field="tags" />
          </div>
          <div>
            <Field label="Support Email *" note="Where users should contact you for help">
              <Inp type="email" placeholder="support@yourapp.com" value={f.supportEmail} onChange={set("supportEmail")} style={stepErrors.supportEmail ? { borderColor: "var(--err)" } : {}} />
            </Field>
            <ErrMsg field="supportEmail" />
          </div>

          <Field label="Brand Color" note="The accent color shown on your app's mosaic tile icon">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="color" value={f.accentColor} onChange={set("accentColor")} style={{ width: 44, height: 40, border: "1px solid var(--border-h)", borderRadius: 8, cursor: "pointer", padding: 2 }} />
              <div style={{ width: 40, height: 40, borderRadius: 10, background: f.accentColor, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "3px", padding: "7px", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.95)" }} />
                <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.45)" }} />
                <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.45)" }} />
                <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.95)" }} />
              </div>
              <span style={{ fontSize: 12, color: "var(--t3)", fontFamily: "var(--mono)" }}>{f.accentColor}</span>
            </div>
          </Field>

          {Object.keys(stepErrors).length > 0 && (
            <div style={{ padding: "12px 16px", background: "var(--err-bg)", border: "1px solid #FECACA", borderRadius: "var(--r)" }}>
              <p style={{ fontSize: 13, color: "var(--err)", fontWeight: 600 }}>Please fill in all required fields before continuing.</p>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <Btn v="secondary" sz="lg" onClick={() => setStep(1)}>Back</Btn>
            <button className="btn-primary-mosaic" onClick={() => tryNext(3)} style={{ padding: "13px 24px", fontSize: 15, borderRadius: "var(--r)", flex: 1 }}>Continue to Media →</button>
          </div>
        </div>
      )}

      {/* STEP 3: Media & Files */}
      {step === 3 && (
        <div style={{ display: "grid", gap: 20 }}>
          <SectionHead n="F" title="App Icon" subtitle="Required — this is your app's identity in the marketplace" />

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px", background: "var(--bg-1)", border: `2px dashed ${stepErrors.icon ? "var(--err)" : iconPreview ? "var(--ok)" : "var(--border-h)"}`, borderRadius: "var(--rl)", cursor: "pointer" }} onClick={() => document.getElementById("bot-icon-input").click()}>
              <div style={{ width: 72, height: 72, borderRadius: 18, background: iconPreview ? "transparent" : f.accentColor, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: iconPreview ? 0 : "4px", padding: iconPreview ? 0 : "12px", flexShrink: 0, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
                {iconPreview ? <img src={iconPreview} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} /> : <>
                  <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.95)" }} />
                  <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.45)" }} />
                  <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.45)" }} />
                  <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.95)" }} />
                </>}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{iconPreview ? "Icon uploaded — click to change" : "Click to upload icon"}</p>
                <p style={{ fontSize: 12, color: "var(--t3)" }}>Square image, 256×256px minimum. PNG or JPG.</p>
                <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>No icon? Your brand color tile will be used.</p>
                {iconPreview && <button onClick={e => { e.stopPropagation(); openCrop(iconPreview, "icon"); }} style={{ marginTop: 8, padding: "4px 12px", background: "var(--bg-0)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "var(--t2)", fontWeight: 600 }}>Crop & Reposition</button>}
              </div>
            </div>
            <input id="bot-icon-input" type="file" accept="image/*" style={{ display: "none" }} onChange={handleIconChange} />
            <ErrMsg field="icon" />
          </div>

          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <SectionHead n="G" title="Screenshots" subtitle="Highly recommended — show people what your app looks like" />

          <div>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 10, lineHeight: 1.5 }}>Upload up to 5 screenshots. These appear on your app's detail page and dramatically increase conversions.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {screenshotPreviews.map((src, i) => (
                <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => openCrop(src, "screenshot", i)} style={{ position: "absolute", bottom: 3, left: 3, padding: "2px 6px", borderRadius: 4, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Edit</button>
                  <button onClick={() => removeScreenshot(i)} style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>&times;</button>
                </div>
              ))}
              {screenshotPreviews.length < 5 && (
                <label style={{ aspectRatio: "1", borderRadius: 10, border: "2px dashed var(--border-h)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "var(--bg-2)", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 20, color: "var(--t3)", lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: 10, color: "var(--t3)" }}>Add</span>
                  <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleScreenshots} />
                </label>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <SectionHead n="H" title="App File" subtitle="Upload your HTML file — this is what users actually run" />

          {/* BRIEF CREATOR TIP */}
          <div style={{ padding: "14px 16px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>💡 What's already available in your app</p>
            <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.7 }}>
              These functions are injected automatically — just use them directly, no imports needed:<br />
              <code style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>window.__mosaicAI(messages, system)</code> — calls Claude using your API key<br />
              <code style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>mosaicSet('key', value)</code> — syncs data to all users in real time <span style={{ color: "var(--t3)" }}>(Live/Shared only)</span><br />
              <code style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>mosaicOn('key', callback)</code> — listens for changes from other users <span style={{ color: "var(--t3)" }}>(Live/Shared only)</span>
            </p>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--t1)"; }}
            onDragLeave={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--border-h)"; }}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--border-h)"; const file = e.dataTransfer.files[0]; if (file) setBotFile(file); }}
            onClick={() => document.getElementById("bot-file-input").click()}
            style={{ border: "2px dashed var(--border-h)", borderRadius: "var(--rl)", padding: "32px 20px", textAlign: "center", cursor: "pointer", background: botFile ? "var(--ok-bg)" : "var(--bg-1)", transition: "all 0.15s" }}
          >
            {botFile ? (
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>{botFile.name}</p>
                <p style={{ fontSize: 12, color: "var(--t3)" }}>{(botFile.size / 1024 / 1024).toFixed(2)} MB · Click to replace</p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--t2)", marginBottom: 4 }}>Drag & drop or click to upload</p>
                <p style={{ fontSize: 12, color: "var(--t3)" }}>HTML file preferred · also accepts .zip, .py, .js — Max 50MB</p>
              </div>
            )}
            <input id="bot-file-input" type="file" accept=".html,.zip,.tar.gz,.py,.js,.json,.tsx,.jsx" style={{ display: "none" }} onChange={handleFileChange} />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn v="secondary" sz="lg" onClick={() => setStep(2)}>Back</Btn>
            <button className="btn-primary-mosaic" onClick={() => { setStepErrors({}); setStep(4); }} style={{ padding: "13px 24px", fontSize: 15, borderRadius: "var(--r)", flex: 1 }}>Review & Submit →</button>
          </div>
        </div>
      )}

      {/* STEP 4: Review */}
      {step === 4 && (
        <div style={{ display: "grid", gap: 16 }}>
          <SectionHead n="✓" title="Review & Submit" subtitle="Everything looks good? Submit for review." />

          <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", overflow: "hidden" }}>
            {/* Icon preview */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "linear-gradient(135deg, #FDFCFB, var(--bg-2))" }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: f.accentColor, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "3px", padding: "9px", flexShrink: 0, overflow: "hidden" }}>
                {iconPreview ? <img src={iconPreview} style={{ width: "400%", height: "400%", objectFit: "cover", borderRadius: 10, transform: "translate(-75%,-75%)" }} /> : <>
                  <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.95)" }} />
                  <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.45)" }} />
                  <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.45)" }} />
                  <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.95)" }} />
                </>}
              </div>
              <div>
                <p style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{f.name || "Untitled"}</p>
                <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{f.category} · {f.aiProvider || "AI"}</p>
              </div>
              <div style={{ marginLeft: "auto", padding: "5px 12px", background: f.price > 0 ? "var(--t1)" : "var(--ok-bg)", color: f.price > 0 ? "#fff" : "var(--ok)", borderRadius: 100, fontSize: 12, fontWeight: 700 }}>{Number(f.price) > 0 ? `$${f.price}/mo` : "Free"}</div>
            </div>

            {[
              { l: "Tagline", v: f.tagline },
              { l: "Use Case", v: f.useCase },
              { l: "Target Audience", v: f.targetAudience },
              { l: "Key Features", v: f.keyFeatures },
              { l: "Tags", v: f.tags },
              { l: "Support Email", v: f.supportEmail },
              { l: "Visibility", v: f.visibility },
              { l: "Screenshots", v: screenshots.length + " image" + (screenshots.length !== 1 ? "s" : "") },
              { l: "Project File", v: botFile?.name || "Not uploaded" },
            ].map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 20px", borderBottom: "1px solid var(--border)", fontSize: 13, gap: 12 }}>
                <span style={{ color: "var(--t3)", fontWeight: 500, flexShrink: 0 }}>{r.l}</span>
                <span style={{ fontWeight: 600, maxWidth: 300, textAlign: "right", lineHeight: 1.4 }}>{r.v || "—"}</span>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--accent-light)", border: "1px solid rgba(91,92,246,0.2)", borderRadius: "var(--r)", padding: "14px 16px", fontSize: 13, color: "var(--accent)", lineHeight: 1.6 }}>
            Free to list. Submissions are reviewed within 48 hours. You keep 85% of every sale.
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn v="secondary" sz="lg" onClick={() => setStep(3)}>Back</Btn>
            <button className="btn-primary-mosaic" onClick={doSubmit} disabled={uploading} style={{ padding: "13px 24px", fontSize: 15, borderRadius: "var(--r)", flex: 1, opacity: uploading ? 0.7 : 1 }}>{uploading ? "Uploading..." : "Submit for Review"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- ADMIN DASHBOARD ---
function AdminPage({ bots, setBots, users, admin }) {
  const [tab, setTab] = useState("bots");
  const [expandedBot, setExpandedBot] = useState(null);

  const [rejectModal, setRejectModal] = useState(null); // { botId, note }
  const [banModal, setBanModal] = useState(null); // { botId, reason }
  const [testBot, setTestBot] = useState(null);

  const updateBot = async (id, changes) => {
    const updated = bots.map(b => b.id === id ? { ...b, ...changes } : b);
    setBots(updated);
    const bot = updated.find(b => b.id === id);
    if (bot) {
      await DB.saveBot(bot);
      if (changes.status === "approved" && bot.creatorEmail) {
        fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "approved", to: bot.creatorEmail, data: { botName: bot.name } }) }).catch(() => {});
      }
    }
  };

  const rejectWithNote = async () => {
    if (!rejectModal) return;
    await updateBot(rejectModal.botId, { status: "rejected", rejectionNote: rejectModal.note, rejectedAt: new Date().toISOString() });
    setRejectModal(null);
  };

  const banApp = async () => {
    if (!banModal) return;
    await updateBot(banModal.botId, { status: "banned", banReason: banModal.reason, bannedAt: new Date().toISOString() });
    setBanModal(null);
  };

  const approveCodeUpdate = async (botId, update) => {
    const bot = bots.find(b => b.id === botId);
    if (!bot) return;
    await updateBot(botId, {
      fileUrl: update.fileUrl || bot.fileUrl,
      fileName: update.fileName || bot.fileName,
      pendingUpdate: null,
      lastUpdated: new Date().toISOString()
    });
  };

  const rejectCodeUpdate = async (botId, note) => {
    await updateBot(botId, { pendingUpdate: { ...bots.find(b => b.id === botId)?.pendingUpdate, rejected: true, rejectionNote: note } });
  };

  const deleteBot = async (id) => {
    if (!confirm("Delete this app permanently?")) return;
    const updated = bots.filter(b => b.id !== id);
    setBots(updated);
    await DB.deleteBot(id);
    setExpandedBot(null);
  };

  const pending = bots.filter(b => b.status === "pending");
  const approved = bots.filter(b => b.status === "approved");
  const rejected = bots.filter(b => b.status === "rejected");
  const banned = bots.filter(b => b.status === "banned");
  const pendingUpdates = bots.filter(b => b.pendingUpdate && !b.pendingUpdate.rejected);
  const totalSubscribers = approved.reduce((s, b) => s + (b.subscribers || 0), 0);

  return (
    <div className="mob-pad" style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 20px 80px", animation: "fadeUp 0.3s" }}>

      {/* REJECT MODAL */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-0)", border: "1px solid var(--border)", borderRadius: "var(--rl)", padding: 24, width: "100%", maxWidth: 420, animation: "fadeUp 0.2s" }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Reject with Feedback</p>
            <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 16 }}>The creator will see this note and can resubmit after fixing the issues.</p>
            <textarea value={rejectModal.note} onChange={e => setRejectModal(p => ({ ...p, note: e.target.value }))}
              placeholder="Explain what needs to be fixed before this can be approved..."
              style={{ width: "100%", padding: "10px 13px", background: "var(--bg-1)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 13, minHeight: 100, resize: "vertical", outline: "none", color: "var(--t1)", lineHeight: 1.6, fontFamily: "var(--sans)", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setRejectModal(null)} style={{ flex: 1, padding: "10px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 13, cursor: "pointer", color: "var(--t2)", fontWeight: 600 }}>Cancel</button>
              <button onClick={rejectWithNote} disabled={!rejectModal.note.trim()} style={{ flex: 2, padding: "10px", background: "#EF4444", border: "none", borderRadius: "var(--r)", fontSize: 13, cursor: "pointer", color: "#fff", fontWeight: 700, opacity: !rejectModal.note.trim() ? 0.5 : 1 }}>Send Rejection</button>
            </div>
          </div>
        </div>
      )}

      {/* BAN MODAL */}
      {banModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-0)", border: "1px solid var(--border)", borderRadius: "var(--rl)", padding: 24, width: "100%", maxWidth: 420, animation: "fadeUp 0.2s" }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "#EF4444" }}>Ban App</p>
            <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 16 }}>This permanently removes the app from the marketplace and prevents resubmission. This action cannot be undone.</p>
            <textarea value={banModal.reason} onChange={e => setBanModal(p => ({ ...p, reason: e.target.value }))}
              placeholder="Reason for ban (internal only)..."
              style={{ width: "100%", padding: "10px 13px", background: "var(--bg-1)", border: "1px solid #FCA5A5", borderRadius: "var(--r)", fontSize: 13, minHeight: 80, resize: "vertical", outline: "none", color: "var(--t1)", lineHeight: 1.6, fontFamily: "var(--sans)", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setBanModal(null)} style={{ flex: 1, padding: "10px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 13, cursor: "pointer", color: "var(--t2)", fontWeight: 600 }}>Cancel</button>
              <button onClick={banApp} disabled={!banModal.reason.trim()} style={{ flex: 2, padding: "10px", background: "#7F1D1D", border: "none", borderRadius: "var(--r)", fontSize: 13, cursor: "pointer", color: "#fff", fontWeight: 700, opacity: !banModal.reason.trim() ? 0.5 : 1 }}>Ban App</button>
            </div>
          </div>
        </div>
      )}

      {/* TEST WORKSHOP MODAL */}
      {testBot && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9998, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-0)", flexShrink: 0 }}>
            <button onClick={() => setTestBot(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "var(--t3)" }}>&larr; Close Workshop</button>
            <div style={{ flex: 1 }} />
            <div style={{ padding: "4px 12px", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 100 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B" }}>TESTING — Not live yet</span>
            </div>
            <Btn sz="sm" onClick={() => { updateBot(testBot.id, { status: "approved" }); setTestBot(null); }}>Approve & Publish</Btn>
            <Btn v="secondary" sz="sm" onClick={() => { setRejectModal({ botId: testBot.id, note: "" }); setTestBot(null); }}>Reject with Note</Btn>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {testBot.fileUrl ? (
              <iframe src={testBot.fileUrl} style={{ width: "100%", height: "100%", border: "none" }} sandbox="allow-scripts allow-same-origin allow-forms" title={`Testing: ${testBot.name}`} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--t3)", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: 16 }}>No HTML file uploaded</p>
                <p style={{ fontSize: 13 }}>This app uses an API endpoint: {testBot.endpoint || "none"}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <h1 style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 500, marginBottom: 4 }}>Admin Dashboard</h1>
      <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 24 }}>Manage submissions, users, and platform.</p>

      {/* STATS */}
      <div className="mob-grid2" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 28 }}>
        {[
          { l: "Pending", v: pending.length, c: pending.length > 0 ? "#F59E0B" : "var(--t1)" },
          { l: "Live", v: approved.length, c: "var(--ok)" },
          { l: "Rejected", v: rejected.length, c: "#EF4444" },
          { l: "Banned", v: banned.length, c: "#7F1D1D" },
          { l: "Updates", v: pendingUpdates.length, c: pendingUpdates.length > 0 ? "#8B5CF6" : "var(--t1)" },
          { l: "Users", v: users.length, c: "var(--t1)" },
        ].map(s => (
          <div key={s.l} style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "14px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--t3)", marginBottom: 3 }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20, overflowX: "auto" }}>
        {[
          { id: "bots", l: `Submissions (${bots.filter(b => b.status !== "banned").length})` },
          { id: "updates", l: `Code Updates${pendingUpdates.length > 0 ? ` (${pendingUpdates.length})` : ""}` },
          { id: "banned", l: `Banned (${banned.length})` },
          { id: "users", l: `Users (${users.length})` },
          { id: "settings", l: "Settings" }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "9px 16px", background: "none", border: "none", borderBottom: tab === t.id ? "2px solid var(--t1)" : "2px solid transparent", color: tab === t.id ? "var(--t1)" : "var(--t3)", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{t.l}</button>
        ))}
      </div>

      {/* SUBMISSIONS TAB */}
      {tab === "bots" && (
        <div style={{ display: "grid", gap: 10 }}>
          {bots.filter(b => b.status !== "banned").length === 0 && <p style={{ fontSize: 14, color: "var(--t3)", padding: "40px 0", textAlign: "center" }}>No submissions yet.</p>}
          {[...pending, ...approved, ...rejected].filter(b => b.status !== "banned").map(bot => (
            <div key={bot.id} style={{ background: "var(--bg-1)", border: `1px solid ${bot.status === "pending" ? "#FDE68A" : bot.status === "rejected" ? "#FECACA" : "var(--border)"}`, borderRadius: "var(--rl)", overflow: "hidden" }}>
              <div onClick={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                  {bot.iconUrl ? <img src={bot.iconUrl} style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 40, height: 40, borderRadius: 10, background: bot.accentColor || "#1C1917", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{(bot.name || "?")[0]}</div>}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{bot.name}</span>
                      <Bdg v={bot.status === "approved" ? "ok" : bot.status === "pending" ? "warn" : "err"}>{bot.status}</Bdg>
                      {bot.sessionType === "live" && <Bdg style={{ background: "rgba(16,185,129,0.1)", color: "var(--ok)", border: "1px solid rgba(16,185,129,0.2)" }}>Live</Bdg>}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--t3)" }}>by {bot.creatorName} · {bot.category} · {bot.price > 0 ? `$${bot.price}/mo` : "Free"}</p>
                  </div>
                </div>
                <span style={{ fontSize: 14, color: "var(--t3)", transform: expandedBot === bot.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>&#9660;</span>
              </div>

              {expandedBot === bot.id && (
                <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--border)", animation: "fadeUp 0.2s" }}>
                  <div style={{ padding: "16px 0", display: "grid", gap: 12 }}>
                    <div className="mob-grid2" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {[
                        { l: "Category", v: bot.category || "—" },
                        { l: "Price", v: bot.price > 0 ? `$${bot.price}/mo` : "Free" },
                        { l: "AI Provider", v: bot.aiProvider || "—" },
                        { l: "Session", v: bot.sessionType || "solo" },
                        { l: "Submitted", v: bot.createdAt ? new Date(bot.createdAt).toLocaleDateString() : "—" },
                        { l: "File", v: bot.fileUrl ? "HTML uploaded" : bot.endpoint ? "Endpoint" : "None" },
                      ].map(r => (
                        <div key={r.l} style={{ background: "var(--bg-0)", borderRadius: "var(--r)", padding: "8px 12px" }}>
                          <p style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>{r.l}</p>
                          <p style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{r.v}</p>
                        </div>
                      ))}
                    </div>

                    <div>
                      <p style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Description</p>
                      <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, maxHeight: 100, overflowY: "auto" }}>{bot.description || "—"}</p>
                    </div>

                    {/* Rejection note if any */}
                    {bot.rejectionNote && (
                      <div style={{ padding: "10px 14px", background: "var(--err-bg)", border: "1px solid #FECACA", borderRadius: "var(--r)" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--err)", marginBottom: 4 }}>REJECTION NOTE SENT TO CREATOR</p>
                        <p style={{ fontSize: 13, color: "var(--err)", lineHeight: 1.5 }}>{bot.rejectionNote}</p>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                      {/* Test workshop */}
                      {bot.fileUrl && <Btn v="secondary" sz="sm" onClick={() => setTestBot(bot)}>Test in Workshop</Btn>}
                      {bot.status === "pending" && <Btn sz="sm" onClick={() => updateBot(bot.id, { status: "approved" })}>Approve</Btn>}
                      {bot.status === "pending" && <Btn v="secondary" sz="sm" onClick={() => setRejectModal({ botId: bot.id, note: "" })}>Reject with Note</Btn>}
                      {bot.status === "approved" && <Btn v="secondary" sz="sm" onClick={() => updateBot(bot.id, { featured: !bot.featured })}>{bot.featured ? "Unfeature" : "Feature"}</Btn>}
                      {bot.status === "rejected" && <Btn sz="sm" onClick={() => updateBot(bot.id, { status: "approved", rejectionNote: null })}>Approve</Btn>}
                      <Btn v="secondary" sz="sm" onClick={() => setBanModal({ botId: bot.id, reason: "" })} style={{ color: "#EF4444", borderColor: "#FECACA" }}>Ban App</Btn>
                      <Btn v="danger" sz="sm" onClick={() => deleteBot(bot.id)}>Delete</Btn>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CODE UPDATES TAB */}
      {tab === "updates" && (
        <div style={{ display: "grid", gap: 10 }}>
          {pendingUpdates.length === 0 && <p style={{ fontSize: 14, color: "var(--t3)", padding: "40px 0", textAlign: "center" }}>No pending code updates.</p>}
          {pendingUpdates.map(bot => (
            <div key={bot.id} style={{ background: "var(--bg-1)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "var(--rl)", padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                {bot.iconUrl ? <img src={bot.iconUrl} style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} /> : <div style={{ width: 40, height: 40, borderRadius: 10, background: bot.accentColor || "#1C1917", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>{(bot.name || "?")[0]}</div>}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 600 }}>{bot.name}</p>
                  <p style={{ fontSize: 12, color: "var(--t3)" }}>Code update requested by {bot.creatorName} · {bot.pendingUpdate?.submittedAt ? new Date(bot.pendingUpdate.submittedAt).toLocaleDateString() : "recently"}</p>
                </div>
                <Bdg style={{ background: "rgba(139,92,246,0.1)", color: "var(--accent)", border: "1px solid rgba(139,92,246,0.2)" }}>Update Pending</Bdg>
              </div>
              {bot.pendingUpdate?.note && (
                <div style={{ padding: "10px 14px", background: "var(--bg-0)", border: "1px solid var(--border)", borderRadius: "var(--r)", marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, marginBottom: 4 }}>CREATOR'S NOTE</p>
                  <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5 }}>{bot.pendingUpdate.note}</p>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {bot.pendingUpdate?.fileUrl && <a href={bot.pendingUpdate.fileUrl} target="_blank" rel="noopener" style={{ padding: "7px 14px", background: "var(--bg-0)", border: "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 12, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>View New File ↗</a>}
                {bot.pendingUpdate?.fileUrl && <Btn v="secondary" sz="sm" onClick={() => setTestBot({ ...bot, fileUrl: bot.pendingUpdate.fileUrl })}>Test Update</Btn>}
                <Btn sz="sm" onClick={() => approveCodeUpdate(bot.id, bot.pendingUpdate)}>Approve Update</Btn>
                <Btn v="secondary" sz="sm" onClick={() => { const note = prompt("Rejection reason for creator:"); if (note) rejectCodeUpdate(bot.id, note); }}>Reject Update</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BANNED TAB */}
      {tab === "banned" && (
        <div style={{ display: "grid", gap: 10 }}>
          {banned.length === 0 && <p style={{ fontSize: 14, color: "var(--t3)", padding: "40px 0", textAlign: "center" }}>No banned apps.</p>}
          {banned.map(bot => (
            <div key={bot.id} style={{ background: "var(--bg-1)", border: "1px solid #FCA5A5", borderRadius: "var(--rl)", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "#7F1D1D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{(bot.name || "?")[0]}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{bot.name}</p>
                  <p style={{ fontSize: 12, color: "var(--t3)" }}>by {bot.creatorName} · Banned {bot.bannedAt ? new Date(bot.bannedAt).toLocaleDateString() : ""}</p>
                </div>
              </div>
              {bot.banReason && <p style={{ fontSize: 12, color: "#EF4444", marginBottom: 12, lineHeight: 1.5 }}>Reason: {bot.banReason}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <Btn v="secondary" sz="sm" onClick={() => updateBot(bot.id, { status: "pending", banReason: null, bannedAt: null })}>Unban</Btn>
                <Btn v="danger" sz="sm" onClick={() => deleteBot(bot.id)}>Delete Permanently</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div style={{ display: "grid", gap: 6 }}>
          {users.length === 0 && <p style={{ fontSize: 14, color: "var(--t3)", padding: "40px 0", textAlign: "center" }}>No registered users yet.</p>}
          {users.map(u => {
            const userBots = bots.filter(b => b.creatorId === u.id);
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 13 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{u.name}</span>
                  <span style={{ color: "var(--t3)" }}> &middot; {u.email}</span>
                  {u.company && <span style={{ color: "var(--t3)" }}> &middot; {u.company}</span>}
                  {userBots.length > 0 && <span style={{ color: "#8B5CF6", fontWeight: 500 }}> &middot; {userBots.length} bot{userBots.length > 1 ? "s" : ""}</span>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {u.googleUid && <Bdg>Google</Bdg>}
                  <Bdg v={u.verified ? "ok" : "warn"}>{u.verified ? "Verified" : "Unverified"}</Bdg>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "settings" && (
        <div style={{ maxWidth: 400 }}>
          <Field label="Admin Email"><Inp value={admin.email} readOnly style={{ background: "var(--bg-2)" }} /></Field>
          <Field label="Contact Email (shown on Contact page)" style={{ marginTop: 16 }}>
            <Inp value={admin.contactEmail || ""} placeholder="support@mosaicbots.com" onChange={async (e) => {
              const newAdmin = { ...admin, contactEmail: e.target.value };
              try { const { setDoc, doc } = await import("firebase/firestore"); await setDoc(doc(db, "config", "admin"), newAdmin, { merge: true }); } catch {}
            }} onBlur={async (e) => {
              try { const { setDoc, doc } = await import("firebase/firestore"); await setDoc(doc(db, "config", "admin"), { ...admin, contactEmail: e.target.value }, { merge: true }); } catch {}
            }} />
          </Field>
          <Field label="Platform Fee (%)" style={{ marginTop: 16 }}><Inp value={admin.platformFee || 15} readOnly style={{ background: "var(--bg-2)" }} /></Field>
          <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 12, lineHeight: 1.6 }}>Contact email saves automatically when you type. Platform fee is configured at the infrastructure level.</p>
        </div>
      )}
    </div>
  );
}

// --- DOCS PAGE ---
function DocsPage({ onNav }) {
  const [tab, setTab] = useState("overview");

  const Code = ({ children }) => (
    <pre style={{ background: "#0F0F0F", border: "1px solid #2a2a2a", borderRadius: 10, padding: "16px 18px", fontSize: 12.5, lineHeight: 1.7, overflowX: "auto", color: "#E5E7EB", fontFamily: "var(--mono)", margin: "10px 0 0" }}>
      <code>{children}</code>
    </pre>
  );

  const Note = ({ type, children }) => (
    <div style={{ padding: "12px 16px", background: type === "warn" ? "rgba(245,158,11,0.08)" : type === "ok" ? "rgba(16,185,129,0.08)" : "rgba(124,111,205,0.08)", border: `1px solid ${type === "warn" ? "rgba(245,158,11,0.2)" : type === "ok" ? "rgba(16,185,129,0.2)" : "rgba(124,111,205,0.2)"}`, borderRadius: 10, marginTop: 12 }}>
      <p style={{ fontSize: 13, color: type === "warn" ? "#D97706" : type === "ok" ? "var(--ok)" : "var(--accent)", lineHeight: 1.6 }}>{children}</p>
    </div>
  );

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 40, paddingBottom: 40, borderBottom: "1px solid var(--border)" }}>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 500, marginBottom: 16, letterSpacing: "-0.02em" }}>{title}</h2>
      {children}
    </div>
  );

  const tabs = [
    { id: "overview", l: "Overview" },
    { id: "solo", l: "Solo Apps" },
    { id: "live", l: "Live & Shared Apps" },
    { id: "submit", l: "Submitting" },
    { id: "revenue", l: "Revenue" },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "44px 24px 100px", animation: "fadeUp 0.3s" }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--t3)", marginBottom: 10 }}>Documentation</p>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 32, fontWeight: 500, marginBottom: 8, letterSpacing: "-0.02em" }}>Build for Mosaic</h1>
      <p style={{ fontSize: 15, color: "var(--t2)", lineHeight: 1.65, marginBottom: 32, maxWidth: 560 }}>Anyone can build and sell AI apps on Mosaic — no backend required. You build a single HTML file, we handle hosting, payments, and live sessions automatically.</p>

      {/* Tab nav */}
      <div style={{ display: "flex", gap: 0, marginBottom: 40, background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", overflow: "hidden", overflowX: "auto" }}>
        {tabs.map((t, i) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px 14px", background: tab === t.id ? "var(--t1)" : "transparent", color: tab === t.id ? "#fff" : "var(--t3)", border: "none", borderRight: i < tabs.length - 1 ? "1px solid var(--border)" : "none", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>{t.l}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && <>
        <Section title="How Mosaic works">
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 16 }}>Mosaic is an AI app marketplace. You build an app, upload it, and anyone can discover, install, and use it — and pay you for it.</p>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { n: "1", t: "Build", d: "Create a single HTML file — no backend, no server, no Firebase setup required. Just HTML, CSS, and JavaScript." },
              { n: "2", t: "Submit", d: "Upload your HTML file on the Create page. Pick your session type: Solo, Private Shared, or Always Live." },
              { n: "3", t: "We review", d: "The Mosaic team reviews your app within 48 hours and publishes it to the marketplace." },
              { n: "4", t: "Get paid", d: "Users install your app and pay a monthly subscription. You keep 85% via Stripe. We send payouts weekly." },
            ].map(s => (
              <div key={s.n} style={{ display: "flex", gap: 14, padding: "16px 18px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--t1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{s.n}</div>
                <div><p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{s.t}</p><p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>{s.d}</p></div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Session types — pick one">
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { i: "👤", t: "Solo", d: "Each user gets their own private experience. Nothing is shared. No Firebase needed. This is the simplest — just build your app and upload it.", ok: true },
              { i: "🔗", t: "Private Shared", d: "Users can invite friends into the same session via a share link. Mosaic automatically adds the multiplayer code — you just use mosaicSet() and mosaicOn() in your app.", ok: true },
              { i: "🟢", t: "Always Live", d: "One persistent room that's always on. Anyone who opens the app joins the same live session. Shows up in the Live Now section on the homepage. Mosaic handles all the live sync automatically.", ok: true },
            ].map(s => (
              <div key={s.t} style={{ display: "flex", gap: 14, padding: "16px 18px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
                <div style={{ fontSize: 24, flexShrink: 0 }}>{s.i}</div>
                <div><p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{s.t}</p><p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>{s.d}</p></div>
              </div>
            ))}
          </div>
        </Section>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setTab("solo")} className="btn-primary-mosaic" style={{ padding: "12px 24px", fontSize: 14, borderRadius: "var(--r)" }}>Build a Solo app →</button>
          <button onClick={() => setTab("live")} style={{ padding: "12px 24px", fontSize: 14, borderRadius: "var(--r)", background: "var(--bg-1)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--t2)", fontWeight: 600 }}>Build a Live app →</button>
        </div>
      </>}

      {/* SOLO */}
      {tab === "solo" && <>
        <Section title="Building a Solo app">
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 12 }}>Solo apps are the simplest. Each user gets their own private experience — nothing is shared between users. You build a single HTML file with all your CSS and JavaScript inside it, upload it to Mosaic, and it runs instantly for anyone who installs it.</p>
          <Note type="ok">✓ No Firebase needed · No backend needed · No setup required — just build and upload</Note>
        </Section>

        <Section title="How to build it">
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 16 }}>You can use any AI tool (Claude, ChatGPT, Gemini, etc.) to build your app for you. Just describe what you want and ask it to generate a single self-contained HTML file. Tell it the app should have a dark, premium UI and work on mobile and desktop.</p>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { t: "Use AI to build it", d: "Describe your app idea to Claude or ChatGPT and ask for a single HTML file. You don't need to know how to code." },
              { t: "Test it locally", d: "Open the HTML file in your browser and make sure it works the way you want before uploading." },
              { t: "Upload and submit", d: "Go to Create on Mosaic, fill in your details, upload the file, and submit. We review it within 48 hours." },
            ].map(s => (
              <div key={s.t} style={{ padding: "14px 18px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{s.t}</p>
                <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Using AI in your app">
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 12 }}>Your app can absolutely use AI — Claude, OpenAI, Gemini, whatever you want. The only rule is you can't paste your secret API key directly inside the HTML file, because anyone could open the page source and see it and steal it.</p>
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 12 }}>The right way is to have your app call a backend server you control — like a simple function hosted on Vercel, Render, or Railway — and that server holds the API key privately and makes the AI call for you. Your HTML file just talks to your server.</p>
          <Note type="warn">⚠️ Apps with API keys pasted directly in the HTML will be rejected for security reasons. Ask the AI building your app to set up a backend function to handle the AI calls.</Note>
        </Section>

        <Section title="What to build">
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 16 }}>Build anything you think people would find genuinely useful or fun. The more specific and niche the better — a general chatbot competes with everything, but an AI built specifically for med spas or real estate agents or law students stands out immediately.</p>
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 16 }}>Some ideas to get you thinking: AI chatbots for specific industries, resume and cover letter tools, AI tutors for specific subjects, business idea validators, social media content generators, AI journaling tools, recipe or meal planners, coding helpers, language learning tools, fitness coaches, financial calculators with AI explanations — the list is endless. If you can imagine someone paying $10–30/month to have it, it's worth building.</p>
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7 }}>The best apps solve one specific problem really well. Don't try to build everything — pick one thing and make it excellent.</p>
        </Section>

        <button onClick={() => setTab("submit")} className="btn-primary-mosaic" style={{ padding: "12px 24px", fontSize: 14, borderRadius: "var(--r)" }}>Ready to submit →</button>
      </>}

      {/* LIVE */}
      {tab === "live" && <>
        <Section title="Building a Live or Shared app">
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 12 }}>Live and Shared apps let multiple users interact together in real time — like a multiplayer game, a shared whiteboard, or a group AI experience. Mosaic automatically handles all the technical setup. You just build your app and use two simple functions.</p>
          <Note type="ok">✓ No Firebase account needed · No config required · Mosaic injects everything automatically when you submit</Note>
        </Section>

        <Section title="The two functions you get">
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 16 }}>When you submit a Live or Shared app, Mosaic automatically adds real-time sync to your HTML file. You get two functions that work immediately — no setup needed:</p>
          <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
            <div style={{ padding: "16px 18px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, fontFamily: "var(--mono)", color: "var(--accent)" }}>mosaicSet('key', value)</p>
              <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>Saves data that all users in the room see instantly. Use this whenever something changes — a new message, a score update, a new question, anything. Every user in the session gets the update in real time.</p>
            </div>
            <div style={{ padding: "16px 18px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, fontFamily: "var(--mono)", color: "var(--accent)" }}>mosaicOn('key', callback)</p>
              <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>Listens for changes from other users. Whenever someone else calls mosaicSet with the same key, your callback runs with the new value. Use this to update your UI when other users do something.</p>
            </div>
          </div>
          <Note type="warn">⚠️ Do NOT add any Firebase code yourself — Mosaic adds it automatically. Just use mosaicSet() and mosaicOn() directly. If you include Firebase imports, your app will break.</Note>
        </Section>

        <Section title="How to tell the AI to build it">
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 12 }}>When you ask an AI to build your Live app, tell it exactly this:</p>
          <div style={{ padding: "16px 18px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.7, fontStyle: "italic" }}>"Build me a single HTML file app with a premium dark UI. For shared state between users, only use <strong style={{ color: "var(--t1)" }}>mosaicSet('key', value)</strong> to save data and <strong style={{ color: "var(--t1)" }}>mosaicOn('key', callback)</strong> to listen for changes. Do not import Firebase or add any backend config — these functions are already available globally. The app should: [describe your app here]"</p>
          </div>
          <p style={{ fontSize: 13, color: "var(--t3)", lineHeight: 1.6 }}>The AI will build your entire app using just those two functions for multiplayer sync. Mosaic adds the real infrastructure when you submit.</p>
        </Section>

        <Section title="What makes a great Live app">
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 16 }}>The best Live apps are ones where being with other people makes the experience better. Think games, group challenges, collaborative tools, or social AI experiences.</p>
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7 }}>Ideas: multiplayer AI trivia, live debate rooms where AI judges, collaborative storytelling, group brainstorming tools, shared AI whiteboards, live word games, real-time polls and voting, group language learning, multiplayer puzzles, or social AI art tools. The Always Live format is especially powerful because there's always something happening when someone opens the app — no waiting, no lobbies.</p>
        </Section>

        <Section title="Live user count">
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7 }}>Mosaic automatically tracks and displays how many users are in each session — on the app card in the marketplace, in the Live Now section on the homepage, and inside the app itself. You don't need to build any of this. It's all automatic.</p>
        </Section>

        <button onClick={() => setTab("submit")} className="btn-primary-mosaic" style={{ padding: "12px 24px", fontSize: 14, borderRadius: "var(--r)" }}>Ready to submit →</button>
      </>}

      {/* SUBMIT */}
      {tab === "submit" && <>
        <Section title="Submitting your app">
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { n: "1", t: "Create an account", d: "Sign up on Mosaic if you haven't already. You need an account to list apps." },
              { n: "2", t: "Go to Create", d: "Click Create in the top navigation. Fill out your app name, description, category, and pricing." },
              { n: "3", t: "Upload your HTML file", d: "In the Media step, upload your single HTML file. This is the file users will actually run." },
              { n: "4", t: "Pick your session type", d: "Choose Solo, Private Shared, or Always Live. If you pick Live or Shared, Mosaic automatically injects the multiplayer code into your file." },
              { n: "5", t: "Set your price", d: "Set a monthly subscription price. Free is allowed. You keep 85% of every payment." },
              { n: "6", t: "Submit", d: "The Mosaic team reviews your app within 48 hours. You'll get an email when it goes live." },
            ].map(s => (
              <div key={s.n} style={{ display: "flex", gap: 14, padding: "16px 18px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--t1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{s.n}</div>
                <div><p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{s.t}</p><p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>{s.d}</p></div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Review checklist">
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 12 }}>Before submitting, make sure your app:</p>
          {[
            "Works completely — no broken buttons, no placeholder text, no errors",
            "Is a single HTML file with all CSS and JavaScript inside",
            "Has a clean, professional UI — not something that looks unfinished",
            "Does something genuinely useful or fun that people would pay for",
            "Works on both mobile and desktop",
            "Does not have any API keys pasted directly in the code",
            "For Live/Shared apps: only uses mosaicSet() and mosaicOn() for shared state — no Firebase imports",
          ].map(item => (
            <div key={item} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--ok)", fontWeight: 700, fontSize: 14 }}>✓</span>
              <p style={{ fontSize: 13, color: "var(--t2)" }}>{item}</p>
            </div>
          ))}
          <Note type="warn">⚠️ Apps with hardcoded API keys will be rejected. Call your own server that holds the key securely.</Note>
        </Section>

        <button onClick={() => onNav("submit")} className="btn-primary-mosaic" style={{ padding: "12px 24px", fontSize: 14, borderRadius: "var(--r)" }}>Start submitting →</button>
      </>}

      {/* REVENUE */}
      {tab === "revenue" && <>
        <Section title="How you get paid">
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { t: "You keep 85%", d: "Mosaic takes a 15% platform fee. The rest goes directly to you via Stripe Connect." },
              { t: "Weekly payouts", d: "Stripe sends your earnings to your bank account every Monday automatically." },
              { t: "Monthly subscriptions", d: "Users pay monthly. As long as they stay subscribed, you keep earning." },
              { t: "Free to list", d: "No upfront cost to create an account or list apps. You only pay when you earn." },
              { t: "Set your own price", d: "You choose the monthly price. You can also list for free to build an audience." },
            ].map(s => (
              <div key={s.t} style={{ padding: "16px 18px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{s.t}</p>
                <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Example earnings">
          <div style={{ display: "grid", gap: 8 }}>
            {[
              { subscribers: 10, price: 9, you: 76.50 },
              { subscribers: 50, price: 19, you: 807.50 },
              { subscribers: 100, price: 29, you: 2465 },
              { subscribers: 500, price: 49, you: 20825 },
            ].map(r => (
              <div key={r.subscribers} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "14px 18px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 13 }}>
                <span style={{ color: "var(--t2)" }}>{r.subscribers} subscribers</span>
                <span style={{ color: "var(--t2)" }}>${r.price}/mo price</span>
                <span style={{ fontWeight: 700, color: "var(--ok)" }}>${r.you.toLocaleString()}/mo to you</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Connect Stripe to get paid">
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7 }}>Go to your Dashboard and click Connect Stripe. It takes about 5 minutes to set up. You'll need your bank account details and a government ID. Once connected, payouts are fully automatic.</p>
        </Section>
      </>}
    </div>
  );
}

// --- LEGAL PAGES ---
function PrivacyPage() {
  return (
    <div style={{ maxWidth: 660, margin: "0 auto", padding: "44px 28px 80px", animation: "fadeUp 0.3s" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 500, marginBottom: 4 }}>Privacy Policy</h1>
      <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 28 }}>Last updated: March 3, 2026</p>
      {[
        { t: "Information We Collect", c: "We collect information you provide when creating an account (name, email, company), listing a bot (bot details, API endpoints), and using the platform (usage data, analytics). We also collect standard technical data such as IP addresses, browser type, and device information through server logs." },
        { t: "How We Use Your Information", c: "We use your information to operate the Mosaic marketplace, process transactions, communicate with you about your account, improve our services, and comply with legal obligations. We do not sell your personal information to third parties." },
        { t: "Data Sharing", c: "We share information with Stripe for payment processing, with bot creators when you subscribe to their bots (limited to what is necessary for service delivery), and with service providers who help us operate the platform. We may disclose information when required by law." },
        { t: "Data Security", c: "We implement industry-standard security measures including encryption in transit (TLS 1.3), encryption at rest, and regular security audits. API keys are stored using one-way hashing. We maintain SOC 2 Type II compliance for our infrastructure." },
        { t: "Your Rights", c: "You may access, correct, or delete your personal information at any time through your account settings or by contacting support@mosaicbots.com. You may also request a full export of your data. California residents have additional rights under the CCPA." },
        { t: "Cookies", c: "We use essential cookies for authentication and session management. We use analytics cookies to understand how the platform is used. You can manage cookie preferences in your browser settings." },
        { t: "Contact", c: "For privacy-related questions, contact us at support@mosaicbots.com or write to Mosaic, Inc., Tampa, FL 33606." },
      ].map((s, i) => (
        <div key={i} style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>{s.t}</h3>
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7 }}>{s.c}</p>
        </div>
      ))}
    </div>
  );
}

function TermsPage() {
  return (
    <div style={{ maxWidth: 660, margin: "0 auto", padding: "44px 28px 80px", animation: "fadeUp 0.3s" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 500, marginBottom: 4 }}>Terms of Service</h1>
      <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 28 }}>Last updated: March 3, 2026</p>
      {[
        { t: "Acceptance of Terms", c: "By accessing or using Mosaic, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform." },
        { t: "Platform Description", c: "Mosaic is a marketplace that connects AI bot creators with businesses seeking AI solutions. We provide the infrastructure for discovery, distribution, and billing. We do not build, operate, or control individual bots listed on the platform." },
        { t: "Accounts", c: "You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 18 years old to create an account." },
        { t: "For Bot Creators", c: "By listing a bot on Mosaic, you grant us a non-exclusive license to display, distribute, and market your bot through our platform. You are solely responsible for the functionality, accuracy, and legal compliance of your bot. You must not list bots that are illegal, harmful, deceptive, or violate third-party rights. Mosaic retains a 15% platform fee on all transactions." },
        { t: "For Users / Subscribers", c: "When you subscribe to a bot, you enter into a service agreement with both Mosaic (for platform access) and the bot creator (for the bot's functionality). Subscriptions auto-renew unless cancelled. Refunds are handled on a case-by-case basis." },
        { t: "Prohibited Conduct", c: "You may not reverse engineer other users' bots, circumvent billing or authentication, submit fraudulent listings, use the platform for illegal purposes, or attempt to access other users' data." },
        { t: "Intellectual Property", c: "Bot creators retain all rights to their bots. Mosaic retains rights to the platform, branding, and proprietary technology. You may not use Mosaic's trademarks without permission." },
        { t: "Limitation of Liability", c: "Mosaic is provided 'as is.' We are not liable for damages arising from bot malfunctions, data loss, service interruptions, or third-party actions. Our total liability is limited to the amount you paid us in the 12 months preceding the claim." },
        { t: "Termination", c: "We may suspend or terminate accounts that violate these terms. You may delete your account at any time. Upon termination, your bot listings will be removed and pending payouts will be processed within 30 days." },
        { t: "Governing Law", c: "These terms are governed by the laws of the State of Florida. Disputes will be resolved through binding arbitration in Tampa, FL." },
        { t: "Contact", c: "Questions about these terms can be directed to support@mosaicbots.com." },
      ].map((s, i) => (
        <div key={i} style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>{s.t}</h3>
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7 }}>{s.c}</p>
        </div>
      ))}
    </div>
  );
}

// --- FOOTER ---
function Footer({ onNav, onTour }) {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", padding: "32px 20px" }}>
      <div className="mob-col1" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 32, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <div style={{ width: 22, height: 22, background: "var(--t1)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", fontFamily: "var(--mono)" }}>M</div>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Mosaic</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.6, maxWidth: 240 }}>The marketplace for production-ready AI bots. Build, deploy, and monetize AI agents.</p>
        </div>
        {[
          { t: "Product", links: [{ l: "Marketplace", id: "home" }, { l: "List a Bot", id: "submit" }, { l: "Documentation", id: "docs" }] },
          { t: "Company", links: [{ l: "About", id: "about" }, { l: "Contact", id: "contact" }] },
          { t: "Legal", links: [{ l: "Privacy Policy", id: "privacy" }, { l: "Terms of Service", id: "terms" }] },
        ].map(col => (
          <div key={col.t}>
            <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--t3)", marginBottom: 12 }}>{col.t}</h4>
            <div style={{ display: "grid", gap: 8 }}>
              {col.links.map(l => <span key={l.l} onClick={() => l.id && onNav(l.id)} style={{ fontSize: 13, color: "var(--t2)", cursor: l.id ? "pointer" : "default" }}>{l.l}</span>)}
            </div>
          </div>
        ))}
      </div>
      <Divider />
      <div className="mob-stack" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 18, fontSize: 11, color: "var(--t3)", gap: 8 }}>
        <span>&copy; 2026 Mosaic. All rights reserved.</span>
        <button onClick={onTour} style={{ display:"flex", alignItems:"center", gap:7, background:"var(--bg-1)", border:"1px solid var(--border)", borderRadius:20, padding:"6px 14px", cursor:"pointer", fontSize:11, fontWeight:600, color:"var(--t2)", letterSpacing:"0.04em", transition:"all 0.15s" }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-h)";e.currentTarget.style.color="var(--t1)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--t2)";}}>
          <div style={{ width:14, height:14, display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5px", padding:"2px", background:"var(--t1)", borderRadius:3, flexShrink:0 }}>
            <div style={{ borderRadius:"0.5px", background:"rgba(255,255,255,0.95)" }} />
            <div style={{ borderRadius:"0.5px", background:"rgba(255,255,255,0.35)" }} />
            <div style={{ borderRadius:"0.5px", background:"rgba(255,255,255,0.35)" }} />
            <div style={{ borderRadius:"0.5px", background:"rgba(255,255,255,0.95)" }} />
          </div>
          Take a Tour
        </button>
        <span>support@mosaicbots.com</span>
      </div>
    </footer>
  );
}

// --- ABOUT PAGE ---
function AboutPage({ onNav }) {
  return (
    <div className="mob-pad" style={{ maxWidth: 600, margin: "0 auto", padding: "clamp(40px,6vw,64px) 20px 80px", animation: "fadeUp 0.3s" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(26px,4vw,36px)", fontWeight: 500, lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 20 }}>About Mosaic</h1>
      <p style={{ fontSize: 15, color: "var(--t2)", lineHeight: 1.8, marginBottom: 20 }}>
        Mosaic is a place to discover and use AI tools made by creators from around the world. Whether you need help studying, want to play an interactive story, or are looking for a creative writing partner, there's an app for that.
      </p>
      <p style={{ fontSize: 15, color: "var(--t2)", lineHeight: 1.8, marginBottom: 20 }}>
        We believe AI should be fun, useful, and accessible to everyone. Not just developers or big companies. That's why we built Mosaic as an app store where anyone can find tools that actually help them, and where creators can share what they build with the world.
      </p>
      <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", padding: "24px", marginBottom: 28 }}>
        <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 14 }}>How it works</h3>
        <div style={{ display: "grid", gap: 14 }}>
          <div><p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>Browse</p><p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>Explore AI apps by category. Each one is built for a specific purpose and ready to use instantly.</p></div>
          <div><p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>Get</p><p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>Tap "Get" on any app. Free apps are instant. Paid apps use a simple monthly subscription.</p></div>
          <div><p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>Use</p><p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>Open the app right here on Mosaic. No downloads, no setup. It just works.</p></div>
          <div><p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>Create</p><p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>Have an idea? Build your own AI app and share it with the Mosaic community. You keep 85% of every sale.</p></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={() => onNav("home")}>Explore Apps</Btn>
        <Btn v="secondary" onClick={() => onNav("submit")}>Create an App</Btn>
      </div>
    </div>
  );
}

// --- CONTACT PAGE ---
function ContactPage({ admin }) {
  const email = admin?.contactEmail || "support@mosaicbots.com";
  return (
    <div className="mob-pad" style={{ maxWidth: 500, margin: "0 auto", padding: "clamp(40px,6vw,64px) 20px 80px", animation: "fadeUp 0.3s" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(26px,4vw,36px)", fontWeight: 500, letterSpacing: "-0.03em", marginBottom: 12 }}>Contact</h1>
      <p style={{ fontSize: 15, color: "var(--t2)", lineHeight: 1.75, marginBottom: 28 }}>
        Questions, feedback, or just want to say hi? Reach out anytime.
      </p>
      <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", padding: "20px" }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Email</p>
          <a href={"mailto:" + email} style={{ fontSize: 15, color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>{email}</a>
          <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>We usually respond within 24 hours.</p>
        </div>
      </div>
    </div>
  );
}

// --- MY APPS (App Store style launcher) ---
function MySubscriptions({ user, bots, onNav, onOpenApp }) {
  const [subs, setSubs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mb_subs_" + user.id) || "[]"); } catch { return []; }
  });
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const subbedBots = bots.filter(b => subs.includes(b.id));
  const categories = ["All", ...new Set(subbedBots.map(b => b.category).filter(Boolean))];

  const filtered = subbedBots.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.name.toLowerCase().includes(q) || (b.category||"").toLowerCase().includes(q) || (b.tagline||"").toLowerCase().includes(q);
    const matchCat = activeFilter === "All" || b.category === activeFilter;
    return matchSearch && matchCat;
  });

  const MosaicIcon = ({ bot, sz = 60 }) => (
    bot.iconUrl
      ? <img src={bot.iconUrl} alt={bot.name} style={{ width: sz, height: sz, borderRadius: sz * 0.26, objectFit: "cover", flexShrink: 0, display: "block" }} />
      : <div style={{ width: sz, height: sz, borderRadius: sz * 0.26, background: bot.accentColor || "var(--t1)", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: sz * 0.05, padding: sz * 0.16, flexShrink: 0, boxShadow: "0 4px 14px rgba(0,0,0,0.14)" }}>
          <div style={{ borderRadius: sz * 0.04, background: "rgba(255,255,255,0.95)" }} />
          <div style={{ borderRadius: sz * 0.04, background: "rgba(255,255,255,0.42)" }} />
          <div style={{ borderRadius: sz * 0.04, background: "rgba(255,255,255,0.42)" }} />
          <div style={{ borderRadius: sz * 0.04, background: "rgba(255,255,255,0.95)" }} />
        </div>
  );

  return (
    <div className="mob-pad" style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 90px", animation: "fadeUp 0.35s ease both" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(26px,4vw,34px)", fontWeight: 400, letterSpacing: "-0.025em", marginBottom: 4 }}>My Library</h1>
          <p style={{ fontSize: 14, color: "var(--t3)", fontWeight: 400 }}>
            {subbedBots.length > 0 ? `${subbedBots.length} installed app${subbedBots.length !== 1 ? "s" : ""}` : "No apps installed yet"}
          </p>
        </div>
        <Btn v="secondary" sz="sm" onClick={() => onNav("home")}>Browse More →</Btn>
      </div>

      {subbedBots.length === 0 ? (
        /* ── EMPTY STATE ── */
        <div style={{ textAlign: "center", padding: "72px 24px", background: "var(--bg-1)", borderRadius: "var(--rl)", border: "1px solid var(--border)", animation: "scaleIn 0.4s ease both" }}>
          {/* Decorative mosaic pattern */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 24px)", gap: 4, margin: "0 auto 28px", width: "fit-content", opacity: 0.18 }}>
            {[0.9,0.4,0.7,0.2,0.6,0.9, 0.5,0.9,0.3,0.8,0.4,0.5, 0.7,0.2,0.9,0.5,0.9,0.3, 0.3,0.8,0.4,0.9,0.2,0.7].map((o,i) => (
              <div key={i} style={{ width: 24, height: 24, borderRadius: 5, background: "var(--t1)", opacity: o }} />
            ))}
          </div>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 400, marginBottom: 10 }}>Your library is empty</h2>
          <p style={{ fontSize: 14, color: "var(--t3)", marginBottom: 28, maxWidth: 340, margin: "0 auto 28px", lineHeight: 1.65 }}>
            Browse the marketplace to find AI tools built by real creators. Free to install, cancel paid apps anytime.
          </p>
          <Btn sz="md" onClick={() => onNav("home")}>Explore Apps</Btn>
        </div>
      ) : (
        <>
          {/* Search + filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <svg style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="var(--t3)" strokeWidth="1.5"/><path d="M11 11l3.5 3.5" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your apps..."
                style={{ width: "100%", padding: "9px 13px 9px 38px", background: "var(--bg-1)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 13.5, outline: "none", color: "var(--t1)" }} />
            </div>
            {categories.length > 2 && categories.map(c => (
              <button key={c} onClick={() => setActiveFilter(c)}
                style={{ padding: "8px 16px", background: activeFilter === c ? "var(--t1)" : "var(--bg-1)", color: activeFilter === c ? "#fff" : "var(--t2)", border: `1px solid ${activeFilter === c ? "transparent" : "var(--border)"}`, borderRadius: 100, fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}>
                {c}
              </button>
            ))}
          </div>

          {/* App grid */}
          {filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--t3)", padding: "40px 0", fontSize: 14 }}>No apps match your search.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
              {filtered.map((b, i) => (
                <div key={b.id} style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", padding: "22px 18px 18px", textAlign: "center", cursor: "pointer", transition: "all 0.28s cubic-bezier(0.23,1,0.32,1)", animation: `scaleIn 0.35s ease ${i * 0.05}s both`, position: "relative", overflow: "hidden" }}
                  onClick={() => onOpenApp(b)}
                  onMouseOver={e => { e.currentTarget.style.transform = "translateY(-5px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(28,25,23,0.1)"; e.currentTarget.style.borderColor = "var(--border-h)"; }}
                  onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                  {/* Top accent line using app color */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: b.accentColor || "var(--accent)", borderRadius: "var(--rl) var(--rl) 0 0" }} />

                  <div style={{ margin: "0 auto 13px", display: "flex", justifyContent: "center" }}>
                    <MosaicIcon bot={b} sz={58} />
                  </div>
                  <p style={{ fontSize: 14.5, fontWeight: 650, marginBottom: 3, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{b.name}</p>
                  <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 14, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{b.category}</p>
                  <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: 16, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.tagline}</p>
                  <div style={{ padding: "8px 18px", background: "var(--t1)", color: "#fff", borderRadius: 100, fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, transition: "all 0.18s" }}>
                    <span>Open</span>
                    <span style={{ fontSize: 10 }}>↗</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick actions bar */}
          <div style={{ marginTop: 36, padding: "20px 22px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Looking for more?</p>
              <p style={{ fontSize: 13, color: "var(--t3)" }}>Discover more AI tools in the marketplace</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="secondary" sz="sm" onClick={() => onNav("home")}>Explore</Btn>
              <Btn sz="sm" onClick={() => onNav("submit")}>Build your own →</Btn>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- APP VIEWER (generic for other bots) ---
// ── MOSAIC AUTO-INJECTION ──
// Injects Firebase + mosaicSet/mosaicOn into creator HTML files automatically
function injectMosaicSDK(html, sessionId) {
  const sdk = `
<script>
// ── Mosaic SDK — auto-injected, do not edit ──
(function() {
  var _db = null;
  var _sessionId = '${sessionId}';
  var _listeners = {};

  // Load Firebase
  var script1 = document.createElement('script');
  script1.type = 'module';
  script1.textContent = \`
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
    import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
    var app = initializeApp({
      apiKey: 'AIzaSyBWbJ5n9ctU6z5mH2TjDmCPgdJpXv_HYxc',
      authDomain: 'mosaicbots.firebaseapp.com',
      databaseURL: 'https://mosaicbots-default-rtdb.firebaseio.com',
      projectId: 'mosaicbots'
    });
    var db = getDatabase(app);
    window.__mosaicDB = db;
    window.__mosaicRef = ref;
    window.__mosaicSet = set;
    window.__mosaicOnValue = onValue;
    window.__mosaicReady = true;
    document.dispatchEvent(new Event('mosaicReady'));
  \`;
  document.head.appendChild(script1);

  // Public API — available immediately, queues until Firebase loads
  window.mosaicSet = function(key, value) {
    function doSet() {
      window.__mosaicSet(window.__mosaicRef(window.__mosaicDB, 'sessions/' + _sessionId + '/state/' + key), value);
    }
    if (window.__mosaicReady) doSet();
    else document.addEventListener('mosaicReady', doSet, { once: true });
  };

  window.mosaicOn = function(key, callback) {
    function doOn() {
      window.__mosaicOnValue(window.__mosaicRef(window.__mosaicDB, 'sessions/' + _sessionId + '/state/' + key), function(snap) {
        callback(snap.val());
      });
    }
    if (window.__mosaicReady) doOn();
    else document.addEventListener('mosaicReady', doOn, { once: true });
  };

  // Live count
  window.__mosaicCount = 0;
  function trackPresence() {
    var uid = 'u_' + Math.random().toString(36).slice(2,8);
    function doPresence() {
      var presRef = window.__mosaicRef(window.__mosaicDB, 'sessions/' + _sessionId + '/users/' + uid);
      window.__mosaicSet(presRef, { t: Date.now() });
      var countRef = window.__mosaicRef(window.__mosaicDB, 'sessions/' + _sessionId + '/users');
      window.__mosaicOnValue(countRef, function(snap) {
        window.__mosaicCount = snap.exists() ? Object.keys(snap.val()).length : 0;
        document.dispatchEvent(new CustomEvent('mosaicCount', { detail: window.__mosaicCount }));
      });
      window.addEventListener('beforeunload', function() {
        window.__mosaicSet(presRef, null);
      });
    }
    if (window.__mosaicReady) doPresence();
    else document.addEventListener('mosaicReady', doPresence, { once: true });
  }
  trackPresence();
})();
<\/script>`;

  // Inject before </body> or at end
  if (html.includes('</body>')) {
    return html.replace('</body>', sdk + '</body>');
  }
  return html + sdk;
}

function AppViewer({ bot, onBack, user }) {
  const [messages, setMessages] = useState([{ role: "bot", text: `Hi! I'm ${bot.name}. ${bot.tagline || "How can I help you today?"}` }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [iframeSrc, setIframeSrc] = useState(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const presenceRef = useRef(null);
  const isLive = bot.sessionType === "live";
  const isMultiplayer = bot.sessionType === "live" || bot.sessionType === "shared";
  const sessionId = isLive ? bot.id : `${bot.id}_${user.id}`;

  // Load and inject HTML file if available
  useEffect(() => {
    if (!bot.fileUrl) return;
    if (!isMultiplayer) {
      // Solo apps — load directly, no fetch needed (avoids CORS)
      setIframeSrc(bot.fileUrl);
      return;
    }
    // Multiplayer — need to inject SDK, so fetch and blob
    setIframeLoading(true);
    fetch(bot.fileUrl, { mode: 'cors' })
      .then(r => {
        if (!r.ok) throw new Error('fetch failed');
        return r.text();
      })
      .then(html => {
        const finalHtml = injectMosaicSDK(html, sessionId);
        const blob = new Blob([finalHtml], { type: 'text/html' });
        setIframeSrc(URL.createObjectURL(blob));
        setIframeLoading(false);
      })
      .catch(() => {
        // Fallback: load directly even for multiplayer if fetch fails
        setIframeSrc(bot.fileUrl);
        setIframeLoading(false);
      });
  }, [bot.fileUrl, sessionId, isMultiplayer]);

  // Live presence tracking
  useEffect(() => {
    if (!isLive) return;
    const countRef = dbRef(rtdb, `sessions/${bot.id}/count`);
    const userRef = dbRef(rtdb, `sessions/${bot.id}/users/${user.id}`);
    presenceRef.current = userRef;
    dbSet(userRef, { name: user.name, joinedAt: Date.now() });
    onDisconnect(userRef).remove();
    const usersRef = dbRef(rtdb, `sessions/${bot.id}/users`);
    const countUnsub = onValue(usersRef, snap => {
      const count = snap.exists() ? Object.keys(snap.val()).length : 0;
      setLiveCount(count);
      dbSet(countRef, count);
    });
    return () => {
      off(usersRef, 'value', countUnsub);
      dbSet(userRef, null);
    };
  }, [bot.id, isLive, user.id]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setLoading(true);
    try {
      if (bot.endpoint) {
        const res = await fetch(bot.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, session_id: sessionId, user_id: user.id }) });
        const data = await res.json();
        setMessages(prev => [...prev, { role: "bot", text: data.response || data.reply || data.message || "I received your message." }]);
      } else {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 500,
            system: `You are ${bot.name}. ${bot.description || bot.tagline || ""}. Be helpful and concise.`,
            messages: [{ role: "user", content: msg }]
          })
        });
        const data = await res.json();
        setMessages(prev => [...prev, { role: "bot", text: data.content?.[0]?.text || "I received your message." }]);
      }
    } catch { setMessages(prev => [...prev, { role: "bot", text: "Connection error. Try again." }]); }
    setLoading(false);
  };

  const LiveBadge = () => isLive ? (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 100 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)", animation: "pulse 1.5s ease-in-out infinite" }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ok)" }}>{liveCount} online</span>
    </div>
  ) : bot.sessionType === "shared" ? (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(124,111,205,0.1)", border: "1px solid rgba(124,111,205,0.2)", borderRadius: 100 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>🔗 Shared</span>
    </div>
  ) : null;

  const Header = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-0)", flexShrink: 0 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "var(--t3)" }}>&larr;</button>
      {bot.iconUrl ? (
        <img src={bot.iconUrl} alt={bot.name} style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bot.accentColor || "#1C1917", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>{(bot.name || "?")[0]}</div>
      )}
      <p style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{bot.name}</p>
      <LiveBadge />
    </div>
  );

  // If HTML file exists — show in iframe
  if (bot.fileUrl) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 54px)" }}>
        <Header />
        {iframeLoading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontSize: 14 }}>Loading app...</div>
        ) : iframeSrc ? (
          <iframe
            src={iframeSrc}
            style={{ flex: 1, border: "none", width: "100%" }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            title={bot.name}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontSize: 14 }}>Could not load app file.</div>
        )}
      </div>
    );
  }

  // Default chat interface (no HTML file uploaded)
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 54px)", maxWidth: 700, margin: "0 auto" }}>
      <Header />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8, background: "var(--bg-0)" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ maxWidth: "80%", alignSelf: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ padding: "10px 14px", borderRadius: 12, borderBottomRightRadius: m.role === "user" ? 4 : 12, borderBottomLeftRadius: m.role === "bot" ? 4 : 12, background: m.role === "user" ? "var(--t1)" : "var(--bg-1)", color: m.role === "user" ? "#fff" : "var(--t1)", fontSize: 14, lineHeight: 1.55, border: m.role === "bot" ? "1px solid var(--border)" : "none" }}>{m.text}</div>
          </div>
        ))}
        {loading && <div style={{ padding: "10px 14px", borderRadius: 12, background: "var(--bg-1)", border: "1px solid var(--border)", fontSize: 14, color: "var(--t3)", alignSelf: "flex-start" }}>Typing...</div>}
      </div>
      <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, background: "var(--bg-0)" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder={`Message ${bot.name}...`}
          style={{ flex: 1, padding: "10px 14px", background: "var(--bg-1)", border: "1px solid var(--border-h)", borderRadius: 10, fontSize: 14, outline: "none", color: "var(--t1)" }} />
        <Btn onClick={sendMessage} disabled={loading || !input.trim()}>Send</Btn>
      </div>
    </div>
  );
}

// --- CREATOR DASHBOARD ---
// --- CODE UPDATE UPLOADER ---
function CodeUpdateUploader({ botId, bots, setBots, user }) {
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!file) return;
    setUploading(true);

    let processedFile = file;
    if (apiKey.trim()) {
      try {
        const html = await file.text();
        const proxySnippet = `\n<script>\nwindow.__mosaicAI = async function(messages, system) {\n  const r = await fetch('https://api.anthropic.com/v1/messages', {\n    method: 'POST',\n    headers: {\n      'content-type': 'application/json',\n      'x-api-key': '${apiKey.trim()}',\n      'anthropic-version': '2023-06-01',\n      'anthropic-dangerous-allow-browser': 'true'\n    },\n    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: system || '', messages })\n  });\n  const d = await r.json();\n  return d.content?.[0]?.text || '';\n};\n<\/script>`;
        const finalHtml = html.includes('</body>')
          ? html.replace('</body>', proxySnippet + '\n</body>')
          : html + proxySnippet;
        processedFile = new File([finalHtml], file.name, { type: 'text/html' });
      } catch(e) { console.error('injection failed', e); }
      setApiKey("");
    }

    const path = `updates/${user.id}/${Date.now()}_${processedFile.name}`;
    const fileUrl = await DB.uploadFile(processedFile, path);
    const bot = bots.find(b => b.id === botId);
    if (bot) {
      const updated = { ...bot, pendingUpdate: { fileUrl, fileName: file.name, note, submittedAt: new Date().toISOString(), rejected: false } };
      await DB.saveBot(updated);
      setBots(bots.map(b => b.id === botId ? updated : b));
    }
    setUploading(false);
    setDone(true);
  };

  if (done) return <p style={{ fontSize: 13, color: "var(--ok)", fontWeight: 600 }}>✓ Update submitted — admin will review within 48 hours</p>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--bg-0)", border: `1px solid ${file ? "var(--ok)" : "var(--border-h)"}`, borderRadius: "var(--r)", cursor: "pointer", fontSize: 13 }}>
        <span style={{ color: file ? "var(--ok)" : "var(--t3)" }}>{file ? `✓ ${file.name}` : "Upload new HTML file"}</span>
        <input type="file" accept=".html" style={{ display: "none" }} onChange={e => setFile(e.target.files[0])} />
      </label>

      {/* API key re-injection */}
      <div style={{ padding: "12px 14px", background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: "var(--r)" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>Anthropic API Key — Optional</p>
        <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8, lineHeight: 1.5 }}>Paste your key to re-inject it into this update. Deleted immediately after upload.</p>
        <div style={{ position: "relative" }}>
          <input type={showKey ? "text" : "password"} placeholder="sk-ant-..." value={apiKey} onChange={e => setApiKey(e.target.value)}
            style={{ width: "100%", padding: "8px 44px 8px 12px", background: "var(--bg-0)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 12, outline: "none", color: "var(--t1)", fontFamily: "var(--mono)", boxSizing: "border-box" }} />
          <button onClick={() => setShowKey(p => !p)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--t3)" }}>{showKey ? "hide" : "show"}</button>
        </div>
      </div>

      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What changed? (optional — helps admin review faster)"
        style={{ width: "100%", padding: "10px 13px", background: "var(--bg-0)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 13, minHeight: 60, resize: "vertical", outline: "none", color: "var(--t1)", lineHeight: 1.6, fontFamily: "var(--sans)", boxSizing: "border-box" }} />
      <Btn sz="sm" onClick={submit} disabled={!file || uploading}>{uploading ? "Uploading..." : "Submit for Review"}</Btn>
    </div>
  );
}

function CreatorDashboard({ user, bots, setBots, setUsers, users }) {
  const [connecting, setConnecting] = useState(false);
  const [connectStatus, setConnectStatus] = useState(null);
  const [editBot, setEditBot] = useState(null);
  const [editF, setEditF] = useState({});
  const [editIconFile, setEditIconFile] = useState(null);
  const [editIconPreview, setEditIconPreview] = useState(null);
  const [editScreenshots, setEditScreenshots] = useState([]);
  const [editScreenshotPreviews, setEditScreenshotPreviews] = useState([]);
  const [editTab, setEditTab] = useState("info");
  const [dashTab, setDashTab] = useState("apps");
  const [myGroups, setMyGroups] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [liveCounts, setLiveCounts] = useState({});
  const myBots = bots.filter(b => b.creatorId === user.id);
  const totalInstalls = myBots.reduce((s, b) => s + (b.downloads || 0), 0);
  const totalSubscribers = myBots.reduce((s, b) => s + (b.subscribers || 0), 0);
  const totalLive = Object.values(liveCounts).reduce((s, v) => s + v, 0);

  // Real-time live counts for all my apps
  useEffect(() => {
    const listeners = myBots.filter(b => b.sessionType === "live").map(bot => {
      const r = dbRef(rtdb, `sessions/${bot.id}/users`);
      const unsub = onValue(r, snap => {
        const count = snap.exists() ? Object.keys(snap.val()).length : 0;
        setLiveCounts(prev => ({ ...prev, [bot.id]: count }));
      });
      return () => off(r, 'value', unsub);
    });
    return () => listeners.forEach(u => u());
  }, [myBots.length]);

  useEffect(() => {
    const checkStatus = () => {
      if (user.stripeAccountId) {
        fetch(`/api/connect-status?accountId=${user.stripeAccountId}`)
          .then(r => r.json())
          .then(data => {
            if (data.accountId) setConnectStatus(data);
            else { setConnectStatus(null); }
          }).catch(() => {});
      }
    };
    checkStatus();
    // Re-check when returning from Stripe onboarding
    const params = new URLSearchParams(window.location.search);
    if (params.get("connect") === "complete") {
      setTimeout(checkStatus, 1500); // give Stripe a moment
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [user.stripeAccountId]);

  const handleConnectStripe = async () => {
    setConnecting(true);
    try {
      // If we have a stored account ID, verify it still exists before using it
      let accountId = user.stripeAccountId || null;
      if (accountId) {
        const check = await fetch(`/api/connect-status?accountId=${accountId}`).then(r => r.json()).catch(() => ({ error: true }));
        if (check.error || !check.accountId) {
          // Account doesn't exist on this platform — clear it and start fresh
          accountId = null;
          const cleaned = { ...user, stripeAccountId: null };
          await DB.saveUser(cleaned);
          setUsers(users.map(u => u.id === user.id ? cleaned : u));
        }
      }
      const res = await fetch("/api/connect-account", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, userId: user.id, name: user.name, stripeAccountId: accountId }),
      });
      const data = await res.json();
      if (data.url) {
        if (data.accountId && !accountId) {
          const updated = { ...user, stripeAccountId: data.accountId };
          await DB.saveUser(updated);
          setUsers(users.map(u => u.id === user.id ? updated : u));
        }
        window.location.href = data.url;
      } else {
        alert("Error: " + (data.error || "Could not start onboarding"));
      }
    } catch (e) { alert("Failed to connect to Stripe. Please try again."); }
    setConnecting(false);
  };

  const startEdit = (b) => {
    setEditBot(b);
    setEditF({
      name: b.name || "", tagline: b.tagline || "", description: b.description || "",
      category: b.category || "", price: String(b.price || 0), aiProvider: b.aiProvider || "",
      tags: b.tags || "", accentColor: b.accentColor || "#1C1917", endpoint: b.endpoint || "",
      website: b.website || "", useCase: b.useCase || "", targetAudience: b.targetAudience || "",
      keyFeatures: b.keyFeatures || "", limitations: b.limitations || "", supportEmail: b.supportEmail || "",
      visibility: b.visibility || "public", pricingModel: b.pricingModel || "subscription",
    });
    setEditIconFile(null);
    setEditIconPreview(b.iconUrl || null);
    setEditScreenshots([]);
    setEditScreenshotPreviews(b.screenshotUrls || []);
  };

  const setEF = k => e => setEditF(prev => ({ ...prev, [k]: e.target.value }));

  const handleEditIcon = (e) => {
    const file = e.target.files[0];
    if (file) { setEditIconFile(file); const r = new FileReader(); r.onload = ev => setEditIconPreview(ev.target.result); r.readAsDataURL(file); }
  };

  const handleEditScreenshots = (e) => {
    const files = Array.from(e.target.files).slice(0, 5 - editScreenshotPreviews.length);
    setEditScreenshots(prev => [...prev, ...files].slice(0, 5));
    files.forEach(file => { const r = new FileReader(); r.onload = ev => setEditScreenshotPreviews(prev => [...prev, ev.target.result].slice(0, 5)); r.readAsDataURL(file); });
  };

  const removeEditScreenshot = (idx) => {
    setEditScreenshots(prev => prev.filter((_, i) => i !== idx));
    setEditScreenshotPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const saveEdit = async () => {
    if (!editBot) return;
    setSaving(true); setSaveMsg("");
    let iconUrl = editBot.iconUrl;
    let screenshotUrls = editBot.screenshotUrls || [];
    if (editIconFile) {
      const path = `icons/${user.id}/${Date.now()}_${editIconFile.name}`;
      iconUrl = await DB.uploadFile(editIconFile, path) || iconUrl;
    }
    // Upload any new screenshots (previews that are data URLs are new)
    const finalScreenshots = [];
    for (let i = 0; i < editScreenshotPreviews.length; i++) {
      if (editScreenshotPreviews[i].startsWith("data:") && editScreenshots[i]) {
        const path = `screenshots/${user.id}/${Date.now()}_${i}_${editScreenshots[i].name}`;
        const url = await DB.uploadFile(editScreenshots[i], path);
        if (url) finalScreenshots.push(url);
      } else if (editScreenshotPreviews[i].startsWith("http")) {
        finalScreenshots.push(editScreenshotPreviews[i]);
      }
    }
    const updated = { ...editBot, ...editF, price: Number(editF.price) || 0, iconUrl, screenshotUrls: finalScreenshots, shareCode: editF.shareCode || editBot.shareCode || null };
    await DB.saveBot(updated);
    setBots(bots.map(b => b.id === updated.id ? updated : b));
    setSaving(false); setSaveMsg("Saved!");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const deleteMyBot = async (id) => {
    if (!confirm("Delete this app permanently? This cannot be undone.")) return;
    await DB.deleteBot(id);
    setBots(bots.filter(b => b.id !== id));
    setEditBot(null);
  };

  const isConnected = connectStatus?.chargesEnabled && connectStatus?.payoutsEnabled;

  useEffect(() => {
    DB.getGroups().then(all => setMyGroups(all.filter(g => g.members?.includes(user.id))));
  }, [user.id]);

  return (
    <div className="mob-pad" style={{ maxWidth: 700, margin: "0 auto", padding: "36px 20px 80px", animation: "fadeUp 0.3s" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 500, marginBottom: 4 }}>Dashboard</h1>
      <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 24 }}>Manage your apps and earnings.</p>

      {/* STRIPE */}
      <div style={{ background: isConnected ? "rgba(5,150,105,0.06)" : "var(--bg-1)", border: `1px solid ${isConnected ? "rgba(5,150,105,0.2)" : "var(--border)"}`, borderRadius: "var(--rl)", padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: isConnected ? "rgba(5,150,105,0.12)" : "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
              {isConnected ? "✓" : "◇"}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: isConnected ? "#065F46" : "var(--t1)", letterSpacing: "-0.01em" }}>{isConnected ? "Stripe connected" : "Set up payouts"}</p>
              <p style={{ fontSize: 11, color: isConnected ? "#047857" : "var(--t3)", marginTop: 1 }}>{isConnected ? `85% of every sale → your bank. Account: ${user.stripeAccountId}` : "Connect Stripe to get paid when users subscribe."}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {isConnected
              ? <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" style={{ padding: "7px 14px", background: "var(--bg-0)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 12, fontWeight: 600, color: "var(--t2)", textDecoration: "none", cursor: "pointer" }}>Open Stripe ↗</a>
              : <Btn sz="sm" onClick={handleConnectStripe} disabled={connecting}>{connecting ? "Connecting..." : "Connect Stripe"}</Btn>}
            {connecting && <Btn sz="sm" v="ghost" onClick={handleConnectStripe} disabled={connecting}>Reconnect</Btn>}
          </div>
        </div>
        {isConnected && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(5,150,105,0.15)" }}>
            {[
              { l: "Status", v: "Active" },
              { l: "Payout schedule", v: "Weekly (Mon)" },
              { l: "Platform fee", v: "15%" },
            ].map(r => (
              <div key={r.l}>
                <p style={{ fontSize: 10, color: "#047857", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>{r.l}</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#065F46" }}>{r.v}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 24 }}>
        {[
          { l: "Apps", v: myBots.length, i: "◈" },
          { l: "Installs", v: totalInstalls, i: "⬇" },
          { l: "Subscribers", v: totalSubscribers, i: "◆" },
          { l: "Live Now", v: totalLive, i: "●", live: true },
        ].map(s => (
          <div key={s.l} style={{ background: "var(--bg-1)", border: `1px solid ${s.live && totalLive > 0 ? "rgba(16,185,129,0.3)" : "var(--border)"}`, borderRadius: "var(--r)", padding: "14px 12px", textAlign: "center", position: "relative", overflow: "hidden" }}>
            {s.live && totalLive > 0 && <div style={{ position: "absolute", inset: 0, background: "rgba(16,185,129,0.04)" }} />}
            <p style={{ fontSize: 10, color: s.live && totalLive > 0 ? "var(--ok)" : "var(--t3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{s.l}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: s.live && totalLive > 0 ? "var(--ok)" : "var(--t1)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              {s.live && totalLive > 0 && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ok)", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />}
              {s.v}
            </p>
          </div>
        ))}
      </div>

      {/* DASH TABS */}
      <div style={{ display:"flex", borderBottom:"1px solid var(--border)", marginBottom:24 }}>
        {[{id:"apps",l:"My Apps"},{id:"groups",l:"My Groups"}].map(t=>(
          <button key={t.id} onClick={()=>setDashTab(t.id)} style={{ padding:"10px 18px", background:"none", border:"none", borderBottom:dashTab===t.id?"2px solid var(--t1)":"2px solid transparent", color:dashTab===t.id?"var(--t1)":"var(--t3)", fontSize:13, fontWeight:dashTab===t.id?700:500, cursor:"pointer", letterSpacing:"-0.01em" }}>{t.l}</button>
        ))}
      </div>

      {/* MY GROUPS */}
      {dashTab === "groups" && (
        <div style={{ display:"grid", gap:10 }}>
          {myGroups.length === 0 ? (
            <div style={{ background:"var(--bg-1)", border:"1px solid var(--border)", borderRadius:"var(--rl)", padding:"32px 20px", textAlign:"center" }}>
              <div style={{ width:40, height:40, margin:"0 auto 12px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px", padding:"7px", background:"var(--bg-2)", borderRadius:9 }}>
                <div style={{ borderRadius:"1px", background:"var(--border-h)" }} /><div style={{ borderRadius:"1px", background:"var(--border-h)", opacity:0.5 }} />
                <div style={{ borderRadius:"1px", background:"var(--border-h)", opacity:0.5 }} /><div style={{ borderRadius:"1px", background:"var(--border-h)" }} />
              </div>
              <p style={{ fontSize:14, color:"var(--t2)", marginBottom:4, fontWeight:600 }}>No groups yet</p>
              <p style={{ fontSize:12, color:"var(--t3)" }}>Join groups from the Groups page.</p>
            </div>
          ) : myGroups.map(grp=>(
            <div key={grp.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 18px", background:"var(--bg-1)", border:"1px solid var(--border)", borderRadius:"var(--rl)" }}>
              <div style={{ width:38, height:38, display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px", padding:"6px", background:"var(--t1)", borderRadius:8, flexShrink:0 }}>
                <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.95)" }} /><div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.35)" }} />
                <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.35)" }} /><div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.95)" }} />
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14, fontWeight:600, letterSpacing:"-0.01em", marginBottom:2 }}>{grp.name}</p>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  <span style={{ fontSize:11, color:"var(--t3)" }}>{(grp.members||[]).length} members</span>
                  <span style={{ fontSize:11, color:"var(--t3)" }}>{(grp.appIds||[]).length} apps</span>
                  <span style={{ fontSize:10, padding:"1px 7px", background:grp.privacy==="private"?"rgba(220,38,38,0.06)":"rgba(5,150,105,0.06)", border:`1px solid ${grp.privacy==="private"?"rgba(220,38,38,0.15)":"rgba(5,150,105,0.15)"}`, borderRadius:3, color:grp.privacy==="private"?"var(--err)":"var(--ok)", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>{grp.privacy||"public"}</span>
                  {grp.creatorId===user.id && <span style={{ fontSize:10, padding:"1px 7px", background:"rgba(124,111,205,0.08)", border:"1px solid rgba(124,111,205,0.2)", borderRadius:3, color:"var(--accent)", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Owner</span>}
                </div>
              </div>
              {grp.creatorId===user.id && grp.inviteCode && (
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <span style={{ fontFamily:"var(--mono)", fontWeight:700, fontSize:14, letterSpacing:"0.1em" }}>{grp.inviteCode}</span>
                  <button onClick={e=>copyText(grp.inviteCode, e.currentTarget)} style={{ background:"none", border:"1px solid var(--border-h)", borderRadius:4, padding:"2px 8px", fontSize:10, cursor:"pointer", color:"var(--t3)", fontWeight:600 }}>Copy</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MY APPS */}
      {dashTab === "apps" && <><h3 style={{ fontSize:16, fontWeight:700, marginBottom:12 }}>My Apps</h3>
      {myBots.length === 0 ? (
        <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", padding: "32px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--t2)", marginBottom: 8 }}>You haven't created any apps yet.</p>
          <p style={{ fontSize: 12, color: "var(--t3)" }}>Go to Create to get started.</p>
        </div>
      ) : !editBot ? (
        <div style={{ display: "grid", gap: 8 }}>
          {myBots.map(b => (
            <div key={b.id} onClick={() => startEdit(b)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", cursor: "pointer", transition: "all 0.15s" }}
              onMouseOver={e => e.currentTarget.style.borderColor = "var(--accent)"} onMouseOut={e => e.currentTarget.style.borderColor = "var(--border)"}>
              {b.iconUrl ? (
                <img src={b.iconUrl} alt={b.name} style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 12, background: b.accentColor || "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: "#fff", fontFamily: "var(--mono)", flexShrink: 0 }}>{(b.name || "?")[0]}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <p style={{ fontSize: 15, fontWeight: 600 }}>{b.name}</p>
                  <Bdg style={{ background: b.status === "approved" ? "var(--ok-bg)" : b.status === "pending" ? "var(--warn-bg)" : "var(--err-bg)", color: b.status === "approved" ? "var(--ok)" : b.status === "pending" ? "var(--warn)" : "var(--err)" }}>{b.status}</Bdg>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "var(--t3)" }}>⬇ {b.downloads || 0} installs</span>
                  <span style={{ fontSize: 11, color: "var(--t3)" }}>◆ {b.subscribers || 0} subscribers</span>
                  {b.sessionType === "live" && (
                    <span style={{ fontSize: 11, color: liveCounts[b.id] > 0 ? "var(--ok)" : "var(--t3)", display: "flex", alignItems: "center", gap: 3 }}>
                      {liveCounts[b.id] > 0 && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--ok)", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />}
                      {liveCounts[b.id] || 0} online now
                    </span>
                  )}
                  {b.price > 0 && <span style={{ fontSize: 11, color: "var(--t3)" }}>${b.price}/mo</span>}
                </div>
              </div>
              <span style={{ fontSize: 12, color: "var(--t3)" }}>Edit →</span>
            </div>
          ))}
        </div>
      ) : (
        /* EDIT VIEW — full screen overlay */
        <div style={{ position: "fixed", inset: 0, background: "var(--bg-0)", zIndex: 999, overflowY: "auto", animation: "fadeUp 0.2s" }}>
          {/* Top bar */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-0)", backdropFilter: "blur(10px)" }}>
            <button onClick={() => setEditBot(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "7px 13px", fontSize: 13, cursor: "pointer", color: "var(--t2)", fontWeight: 600 }}>← Back</button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              {editIconPreview ? <img src={editIconPreview} style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover" }} /> : <div style={{ width: 34, height: 34, borderRadius: 9, background: editF.accentColor || "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>{(editF.name || "?")[0]}</div>}
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>{editF.name || editBot.name}</p>
                <p style={{ fontSize: 11, color: editBot.status === "approved" ? "var(--ok)" : editBot.status === "pending" ? "var(--warn)" : "var(--err)" }}>{editBot.status === "approved" ? "Live" : editBot.status === "pending" ? "Under review" : "Rejected"}</p>
              </div>
            </div>
            {saveMsg && <span style={{ fontSize: 12, color: "var(--ok)", fontWeight: 600 }}>✓ {saveMsg}</span>}
            <button className="btn-primary-mosaic" onClick={saveEdit} disabled={saving} style={{ padding: "9px 20px", fontSize: 13, borderRadius: "var(--r)", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving..." : "Save Changes"}</button>
          </div>

          {/* Section tabs */}
          {(() => {
            const tabs = [
              { id: "info", l: "Info" },
              { id: "pricing", l: "Pricing & Tags" },
              { id: "technical", l: "Technical" },
              { id: "media", l: "Media" },
              { id: "code", l: editBot.status === "approved" ? (editBot.pendingUpdate && !editBot.pendingUpdate.rejected ? "Code Update ⏳" : "Update Code") : "Status" },
            ];
            return (
              <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px" }}>
                {/* Tab nav */}
                <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 28, marginTop: 8, overflowX: "auto" }}>
                  {tabs.map(t => (
                    <button key={t.id} onClick={() => setEditTab(t.id)} style={{ padding: "12px 18px", background: "none", border: "none", borderBottom: editTab === t.id ? "2px solid var(--t1)" : "2px solid transparent", color: editTab === t.id ? "var(--t1)" : "var(--t3)", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{t.l}</button>
                  ))}
                </div>

                {/* INFO */}
                {editTab === "info" && (
                  <div style={{ display: "grid", gap: 16, paddingBottom: 60 }}>
                    {editBot.rejectionNote && (
                      <div style={{ padding: "14px 16px", background: "var(--err-bg)", border: "1px solid #FECACA", borderRadius: "var(--r)" }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--err)", marginBottom: 6 }}>Rejected — fix these issues and resubmit</p>
                        <p style={{ fontSize: 13, color: "#991B1B", lineHeight: 1.6 }}>{editBot.rejectionNote}</p>
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="App Name"><Inp value={editF.name} onChange={setEF("name")} /></Field>
                      <Field label="Category"><Sel value={editF.category} onChange={setEF("category")}><option value="">Select</option>{CATEGORIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}</Sel></Field>
                    </div>
                    <Field label="Tagline" note="One sentence shown on the marketplace card"><Inp value={editF.tagline} onChange={setEF("tagline")} /></Field>
                    <Field label="Full Description"><textarea value={editF.description} onChange={setEF("description")} style={{ width: "100%", padding: "10px 12px", background: "var(--bg-1)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 14, resize: "vertical", minHeight: 140, outline: "none", color: "var(--t1)", lineHeight: 1.6, fontFamily: "var(--sans)", boxSizing: "border-box" }} /></Field>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Use Case"><Inp value={editF.useCase} onChange={setEF("useCase")} /></Field>
                      <Field label="Target Audience"><Inp value={editF.targetAudience} onChange={setEF("targetAudience")} /></Field>
                    </div>
                    <Field label="Key Features"><textarea value={editF.keyFeatures} onChange={setEF("keyFeatures")} style={{ width: "100%", padding: "10px 12px", background: "var(--bg-1)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 14, resize: "vertical", minHeight: 90, outline: "none", color: "var(--t1)", lineHeight: 1.6, fontFamily: "var(--sans)", boxSizing: "border-box" }} /></Field>
                    <Field label="Known Limitations" note="Optional"><textarea value={editF.limitations} onChange={setEF("limitations")} style={{ width: "100%", padding: "10px 12px", background: "var(--bg-1)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 14, resize: "vertical", minHeight: 60, outline: "none", color: "var(--t1)", lineHeight: 1.6, fontFamily: "var(--sans)", boxSizing: "border-box" }} /></Field>
                  </div>
                )}

                {/* PRICING */}
                {editTab === "pricing" && (
                  <div style={{ display: "grid", gap: 16, paddingBottom: 60 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Price (USD/month)" note="Set to 0 for free"><Inp type="number" value={editF.price} onChange={setEF("price")} /></Field>
                      <Field label="Support Email"><Inp type="email" value={editF.supportEmail} onChange={setEF("supportEmail")} /></Field>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Tags" note="Comma-separated — how people find your app"><Inp value={editF.tags} onChange={setEF("tags")} placeholder="ai, booking, automation" /></Field>
                      <Field label="Website"><Inp type="url" value={editF.website} onChange={setEF("website")} placeholder="https://" /></Field>
                    </div>
                    <Field label="Visibility">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[{ id: "public", l: "Public", d: "Listed in marketplace" }, { id: "private", l: "Private", d: "Share code only" }].map(v => (
                          <div key={v.id} onClick={() => {
                            const update = { visibility: v.id };
                            if (v.id === "private" && !editBot.shareCode && !editF.shareCode) {
                              update.shareCode = Math.random().toString(36).slice(2, 10).toUpperCase();
                            }
                            setEditF(p => ({ ...p, ...update }));
                          }} style={{ padding: "12px 14px", background: editF.visibility === v.id ? "var(--t1)" : "var(--bg-1)", color: editF.visibility === v.id ? "#fff" : "var(--t2)", border: `1px solid ${editF.visibility === v.id ? "var(--t1)" : "var(--border-h)"}`, borderRadius: "var(--r)", cursor: "pointer" }}>
                            <p style={{ fontSize: 13, fontWeight: 600 }}>{v.l}</p>
                            <p style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{v.d}</p>
                          </div>
                        ))}
                      </div>
                    </Field>
                    {editF.visibility === "private" && (editF.shareCode || editBot.shareCode) && (
                      <div style={{ padding: "14px 16px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8, letterSpacing: "0.07em", textTransform: "uppercase" }}>Share Code</p>
                        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10, lineHeight: 1.5 }}>Anyone with this code can access your private app.</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 22, letterSpacing: "0.12em" }}>{editF.shareCode || editBot.shareCode}</span>
                          <button onClick={e => {
                            const code = editF.shareCode || editBot.shareCode;
                            const el = document.createElement("textarea"); el.value = code; el.style.position="fixed"; el.style.opacity="0"; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el);
                            const b = e.currentTarget; const orig = b.textContent; b.textContent = "✓ Copied to clipboard"; setTimeout(()=>b.textContent=orig, 2000);
                          }} style={{ padding: "7px 14px", background: "var(--bg-2)", border: "1px solid var(--border-h)", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "var(--t2)", fontWeight: 600, transition: "all 0.15s" }}>Copy</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TECHNICAL */}
                {editTab === "technical" && (
                  <div style={{ display: "grid", gap: 16, paddingBottom: 60 }}>
                    <Field label="AI Provider">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                        {AI_PROVIDERS.map(p => (
                          <div key={p.id} onClick={() => setEditF(prev => ({ ...prev, aiProvider: p.name }))} style={{ padding: "9px", background: editF.aiProvider === p.name ? "var(--t1)" : "var(--bg-1)", color: editF.aiProvider === p.name ? "#fff" : "var(--t2)", border: `1px solid ${editF.aiProvider === p.name ? "var(--t1)" : "var(--border-h)"}`, borderRadius: "var(--r)", cursor: "pointer", fontSize: 11, fontWeight: 600, textAlign: "center" }}>{p.name}</div>
                        ))}
                      </div>
                    </Field>
                    <Field label="API Endpoint" note="The URL your app uses for AI calls"><Inp value={editF.endpoint} onChange={setEF("endpoint")} placeholder="https://api.yourapp.com/chat" /></Field>
                    <Field label="Brand Color">
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <input type="color" value={editF.accentColor} onChange={setEF("accentColor")} style={{ width: 44, height: 40, border: "1px solid var(--border-h)", borderRadius: 8, cursor: "pointer", padding: 2 }} />
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: editF.accentColor, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "3px", padding: "7px" }}>
                          <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.95)" }} />
                          <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.45)" }} />
                          <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.45)" }} />
                          <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.95)" }} />
                        </div>
                        <span style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--t3)" }}>{editF.accentColor}</span>
                      </div>
                    </Field>
                  </div>
                )}

                {/* MEDIA */}
                {editTab === "media" && (
                  <div style={{ display: "grid", gap: 20, paddingBottom: 60 }}>
                    <Field label="App Icon" note="Square, 256×256px minimum, PNG or JPG">
                      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px", background: "var(--bg-1)", border: "2px dashed var(--border-h)", borderRadius: "var(--rl)", cursor: "pointer" }} onClick={() => document.getElementById("edit-icon-input").click()}>
                        <div style={{ width: 64, height: 64, borderRadius: 16, background: editF.accentColor, overflow: "hidden", flexShrink: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "3px", padding: editIconPreview ? 0 : "10px" }}>
                          {editIconPreview ? <img src={editIconPreview} style={{ width: "400%", height: "400%", objectFit: "cover", transform: "translate(-75%,-75%)" }} /> : <><div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.95)" }} /><div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.45)" }} /><div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.45)" }} /><div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.95)" }} /></>}
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{editIconPreview ? "Icon uploaded — click to change" : "Click to upload icon"}</p>
                        <input id="edit-icon-input" type="file" accept="image/*" style={{ display: "none" }} onChange={handleEditIcon} />
                      </div>
                    </Field>
                    <Field label="Screenshots" note="Up to 5 — shown on your app's detail page">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                        {editScreenshotPreviews.map((src, i) => (
                          <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }}>
                            <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <button onClick={() => removeEditScreenshot(i)} style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>&times;</button>
                          </div>
                        ))}
                        {editScreenshotPreviews.length < 5 && (
                          <label style={{ aspectRatio: "1", borderRadius: 10, border: "2px dashed var(--border-h)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "var(--bg-1)", flexDirection: "column", gap: 3 }}>
                            <span style={{ fontSize: 20, color: "var(--t3)" }}>+</span>
                            <span style={{ fontSize: 10, color: "var(--t3)" }}>Add</span>
                            <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleEditScreenshots} />
                          </label>
                        )}
                      </div>
                    </Field>
                  </div>
                )}

                {/* CODE UPDATE / STATUS */}
                {editTab === "code" && (
                  <div style={{ display: "grid", gap: 16, paddingBottom: 60 }}>
                    {/* Status banner */}
                    <div style={{ padding: "14px 18px", background: editBot.status === "approved" ? "var(--ok-bg)" : editBot.status === "pending" ? "var(--warn-bg)" : "var(--err-bg)", border: `1px solid ${editBot.status === "approved" ? "#A7F3D0" : editBot.status === "pending" ? "#FED7AA" : "#FECACA"}`, borderRadius: "var(--r)" }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: editBot.status === "approved" ? "#065F46" : editBot.status === "pending" ? "#9A3412" : "#991B1B" }}>
                        {editBot.status === "approved" ? "Your app is live on the marketplace" : editBot.status === "pending" ? "Under review — usually within 48 hours" : "Rejected"}
                      </p>
                    </div>

                    {editBot.status === "approved" && (
                      <div style={{ padding: "20px", background: "var(--bg-1)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "var(--rl)" }}>
                        <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Update App Code</p>
                        <p style={{ fontSize: 13, color: "var(--t3)", lineHeight: 1.6, marginBottom: 16 }}>Upload a new version of your HTML file. Admin reviews it before it goes live — your current version keeps running until approved.</p>
                        {editBot.pendingUpdate && !editBot.pendingUpdate.rejected ? (
                          <div style={{ padding: "12px 16px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--r)" }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--warn)" }}>Update pending review</p>
                            <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 3 }}>Submitted {editBot.pendingUpdate.submittedAt ? new Date(editBot.pendingUpdate.submittedAt).toLocaleDateString() : "recently"}. You'll be notified when it's approved.</p>
                          </div>
                        ) : (
                          <div>
                            {editBot.pendingUpdate?.rejected && (
                              <div style={{ padding: "12px 14px", background: "var(--err-bg)", borderRadius: "var(--r)", marginBottom: 14 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--err)" }}>Last update was rejected</p>
                                {editBot.pendingUpdate.rejectionNote && <p style={{ fontSize: 12, color: "var(--t2)", marginTop: 4, lineHeight: 1.5 }}>{editBot.pendingUpdate.rejectionNote}</p>}
                              </div>
                            )}
                            <CodeUpdateUploader botId={editBot.id} bots={bots} setBots={setBots} user={user} />
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: 8, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                      <Btn v="danger" sz="sm" onClick={() => deleteMyBot(editBot.id)}>Delete App</Btn>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
      </>}
    </div>
  );
}


// --- GROUPS PAGE ---
function GroupsPage({ user, bots, onAuth, onBotClick }) {
  const [groups, setGroups] = useState([]);
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name:"", description:"", topic:"AI Tools", privacy:"public", color:"#1C1917" });
  const [editForm, setEditForm] = useState({ name:"", description:"", topic:"", privacy:"public", color:"#1C1917" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState("apps"); // "apps" | "members" | "settings"

  const TOPICS = ["AI Tools","Creative","Productivity","Games","Health","Education","Finance","Developer","Lifestyle","Research","Social"];

  const copyText = async (text, btn) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback for HTTP or restricted contexts
      const el = document.createElement("textarea");
      el.value = text; el.style.position = "fixed"; el.style.opacity = "0";
      document.body.appendChild(el); el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    if (btn) { const orig = btn.textContent; btn.textContent = "Copied!"; setTimeout(()=>btn.textContent=orig, 1500); }
  };

  useEffect(() => { DB.getGroups().then(g => { setGroups(g); setLoading(false); }); }, []);

  const genCode = () => Math.random().toString(36).substring(2,8).toUpperCase();

  const createGroup = async () => {
    if (!form.name.trim() || !user) return;
    setSaving(true);
    const g = { id:"grp_"+Date.now(), name:form.name.trim(), description:form.description.trim(), topic:form.topic, privacy:form.privacy, color:form.color||"#1C1917", inviteCode:genCode(), creatorId:user.id, creatorName:user.name, members:[user.id], appIds:[], createdAt:new Date().toISOString() };
    await DB.saveGroup(g);
    setGroups(p=>[g,...p]);
    setForm({ name:"", description:"", topic:"AI Tools", privacy:"public", color:"#1C1917" });
    setShowCreate(false);
    setSaving(false);
    openGroup(g);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    const updated = { ...selected, name:editForm.name.trim(), description:editForm.description.trim(), topic:editForm.topic, privacy:editForm.privacy, color:editForm.color||"#1C1917" };
    await DB.saveGroup(updated);
    setGroups(p=>p.map(x=>x.id===updated.id?updated:x));
    setSelected(updated);
    setShowEdit(false);
    setSaving(false);
  };

  const deleteGroup = async () => {
    if (!selected) return;
    await DB.deleteGroup(selected.id);
    setGroups(p=>p.filter(x=>x.id!==selected.id));
    setConfirmDelete(false);
    setView("list");
    setSelected(null);
  };

  const regenerateCode = async () => {
    const updated = { ...selected, inviteCode: genCode() };
    await DB.saveGroup(updated);
    setGroups(p=>p.map(x=>x.id===updated.id?updated:x));
    setSelected(updated);
  };

  const kickMember = async (memberId) => {
    if (!selected || memberId === selected.creatorId) return;
    const updated = { ...selected, members: selected.members.filter(id=>id!==memberId) };
    await DB.saveGroup(updated);
    setGroups(p=>p.map(x=>x.id===updated.id?updated:x));
    setSelected(updated);
  };

  const joinByCode = async () => {
    if (!user) return onAuth();
    const g = groups.find(g=>g.inviteCode===joinCode.toUpperCase().trim());
    if (!g) return alert("Group not found. Check the invite code.");
    await doJoin(g); setJoinCode(""); openGroup(g);
  };

  const doJoin = async (g) => {
    if (!user) return onAuth();
    if (g.members?.includes(user.id)) return;
    const u = { ...g, members:[...(g.members||[]),user.id] };
    await DB.saveGroup(u);
    setGroups(p=>p.map(x=>x.id===u.id?u:x));
    if (selected?.id===g.id) setSelected(u);
  };

  const doLeave = async (g) => {
    if (!user || g.creatorId===user.id) return;
    const u = { ...g, members:(g.members||[]).filter(id=>id!==user.id) };
    await DB.saveGroup(u);
    setGroups(p=>p.map(x=>x.id===u.id?u:x));
    setView("list"); setSelected(null);
  };

  const addApp = async (g, botId) => {
    if (g.appIds?.includes(botId)) return;
    const u = { ...g, appIds:[...(g.appIds||[]),botId] };
    await DB.saveGroup(u);
    setGroups(p=>p.map(x=>x.id===u.id?u:x));
    if (selected?.id===g.id) setSelected(u);
  };

  const removeApp = async (g, botId) => {
    const u = { ...g, appIds:(g.appIds||[]).filter(id=>id!==botId) };
    await DB.saveGroup(u);
    setGroups(p=>p.map(x=>x.id===u.id?u:x));
    if (selected?.id===g.id) setSelected(u);
  };

  const openGroup = (g) => { setSelected(g); setView("detail"); setActiveTab("apps"); window.scrollTo({top:0}); };
  const isMember = g => user && g.members?.includes(user.id);
  const isCreator = g => user && g.creatorId===user.id;

  const MosaicMark = ({sz=40, color="#1C1917"}) => (
    <div style={{ width:sz, height:sz, display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"1fr 1fr", gap:sz*0.07+"px", padding:sz*0.17+"px", background:color, borderRadius:sz*0.2, flexShrink:0, boxShadow:`0 2px 12px ${color}40` }}>
      <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.96)" }} />
      <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.36)" }} />
      <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.36)" }} />
      <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.96)" }} />
    </div>
  );

  const Badge = ({v,children}) => <span style={{ fontSize:10, padding:"2px 8px", background:v==="private"?"rgba(220,38,38,0.06)":v==="public"?"rgba(5,150,105,0.06)":"var(--bg-2)", border:`1px solid ${v==="private"?"rgba(220,38,38,0.15)":v==="public"?"rgba(5,150,105,0.15)":"var(--border)"}`, borderRadius:4, color:v==="private"?"var(--err)":v==="public"?"var(--ok)":"var(--t3)", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>{children}</span>;

  // ══ EDIT MODAL ══════════════════════════════════════════════════════════════
  const EditModal = () => (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"var(--bg-0)", border:"1px solid var(--border)", borderRadius:"var(--rl)", padding:32, width:"100%", maxWidth:460, animation:"scaleIn 0.2s" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <p style={{ fontSize:17, fontWeight:700, letterSpacing:"-0.02em", fontFamily:"var(--serif)" }}>Edit Group</p>
          <button onClick={()=>setShowEdit(false)} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"var(--t3)" }}>&times;</button>
        </div>
        <div style={{ display:"grid", gap:16 }}>
          <div>
            <p style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:7, letterSpacing:"0.07em", textTransform:"uppercase" }}>Group Name</p>
            <input value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))} style={{ width:"100%", padding:"10px 13px", background:"var(--bg-1)", border:"1px solid var(--border-h)", borderRadius:"var(--r)", fontSize:14, outline:"none", color:"var(--t1)", boxSizing:"border-box" }} />
          </div>
          <div>
            <p style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:7, letterSpacing:"0.07em", textTransform:"uppercase" }}>Topic</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {TOPICS.map(t=>(
                <button key={t} onClick={()=>setEditForm(p=>({...p,topic:t}))} style={{ padding:"5px 12px", borderRadius:5, border:`1px solid ${editForm.topic===t?"var(--t1)":"var(--border-h)"}`, background:editForm.topic===t?"var(--t1)":"none", color:editForm.topic===t?"#fff":"var(--t2)", fontSize:12, cursor:"pointer", fontWeight:500 }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:7, letterSpacing:"0.07em", textTransform:"uppercase" }}>Visibility</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[{id:"public",l:"Public",d:"Anyone can find & join"},{id:"private",l:"Private",d:"Invite code only"}].map(v=>(
                <div key={v.id} onClick={()=>setEditForm(p=>({...p,privacy:v.id}))} style={{ padding:"12px 14px", background:editForm.privacy===v.id?"var(--t1)":"var(--bg-1)", color:editForm.privacy===v.id?"#fff":"var(--t2)", border:`1px solid ${editForm.privacy===v.id?"var(--t1)":"var(--border-h)"}`, borderRadius:"var(--r)", cursor:"pointer" }}>
                  <p style={{ fontSize:13, fontWeight:700 }}>{v.l}</p>
                  <p style={{ fontSize:11, opacity:0.65, marginTop:2 }}>{v.d}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:7, letterSpacing:"0.07em", textTransform:"uppercase" }}>Description</p>
            <textarea value={editForm.description} onChange={e=>setEditForm(p=>({...p,description:e.target.value}))} style={{ width:"100%", padding:"10px 13px", background:"var(--bg-1)", border:"1px solid var(--border-h)", borderRadius:"var(--r)", fontSize:13, minHeight:68, resize:"vertical", outline:"none", color:"var(--t1)", lineHeight:1.6, fontFamily:"var(--sans)", boxSizing:"border-box" }} />
          </div>
          <div>
            <p style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:9, letterSpacing:"0.07em", textTransform:"uppercase" }}>Group Color</p>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:46, height:46, display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"1fr 1fr", gap:"3px", padding:"8px", background:editForm.color||"#1C1917", borderRadius:10, flexShrink:0, transition:"all 0.2s", boxShadow:"0 2px 10px rgba(0,0,0,0.2)" }}>
                <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.96)" }} />
                <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.36)" }} />
                <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.36)" }} />
                <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.96)" }} />
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, flex:1 }}>
                {["#1C1917","#7C6FCD","#C07A5A","#C9A84C","#0F766E","#1D4ED8","#7C3AED","#BE123C","#065F46","#1E3A5F"].map(c => (
                  <div key={c} onClick={() => setEditForm(p => ({...p, color:c}))} style={{ width:24, height:24, borderRadius:5, background:c, cursor:"pointer", outline:(editForm.color||"#1C1917")===c?"2.5px solid rgba(0,0,0,0.4)":"2.5px solid transparent", outlineOffset:1, transition:"transform 0.1s", transform:(editForm.color||"#1C1917")===c?"scale(1.2)":"scale(1)" }} />
                ))}
                <label style={{ width:24, height:24, borderRadius:5, border:"1.5px dashed var(--border-h)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"var(--t3)", overflow:"hidden", position:"relative" }}>
                  +
                  <input type="color" value={editForm.color||"#1C1917"} onChange={e => setEditForm(p => ({...p, color:e.target.value}))} style={{ position:"absolute", opacity:0, width:"100%", height:"100%", cursor:"pointer" }} />
                </label>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, paddingTop:4 }}>
            <button onClick={()=>setShowEdit(false)} style={{ flex:1, padding:"11px", background:"var(--bg-1)", border:"1px solid var(--border)", borderRadius:"var(--r)", fontSize:13, cursor:"pointer", fontWeight:600, color:"var(--t2)" }}>Cancel</button>
            <button onClick={saveEdit} disabled={!editForm.name.trim()||saving} className="btn-primary-mosaic" style={{ flex:2, padding:"11px", fontSize:13, borderRadius:"var(--r)", opacity:!editForm.name.trim()?0.5:1 }}>{saving?"Saving...":"Save Changes"}</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ══ DELETE CONFIRM MODAL ═════════════════════════════════════════════════
  const DeleteModal = () => (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"var(--bg-0)", border:"1px solid var(--err-border)", borderRadius:"var(--rl)", padding:32, width:"100%", maxWidth:400, animation:"scaleIn 0.2s" }}>
        <p style={{ fontSize:17, fontWeight:700, marginBottom:8, fontFamily:"var(--serif)" }}>Delete Group?</p>
        <p style={{ fontSize:14, color:"var(--t2)", lineHeight:1.6, marginBottom:24 }}>This will permanently delete <strong>{selected?.name}</strong> and remove all members. This cannot be undone.</p>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setConfirmDelete(false)} style={{ flex:1, padding:"11px", background:"var(--bg-1)", border:"1px solid var(--border)", borderRadius:"var(--r)", fontSize:13, cursor:"pointer", fontWeight:600, color:"var(--t2)" }}>Cancel</button>
          <button onClick={deleteGroup} style={{ flex:1, padding:"11px", background:"var(--err)", border:"none", borderRadius:"var(--r)", fontSize:13, cursor:"pointer", fontWeight:700, color:"#fff" }}>Delete Forever</button>
        </div>
      </div>
    </div>
  );

  // ══ DETAIL VIEW ══════════════════════════════════════════════════════════
  if (view === "detail" && selected) {
    const grp = groups.find(g=>g.id===selected.id) || selected;
    const grpBots = bots.filter(b=>b.status==="approved" && (grp.appIds||[]).includes(b.id));
    const addable = user ? bots.filter(b=>b.status==="approved" && b.creatorId===user.id && !(grp.appIds||[]).includes(b.id)) : [];

    return (
      <div style={{ maxWidth:880, margin:"0 auto", padding:"36px 20px 80px", animation:"fadeUp 0.3s" }}>
        {showEdit && <EditModal />}
        {confirmDelete && <DeleteModal />}

        <button onClick={()=>{setView("list");setSelected(null);}} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", fontSize:13, cursor:"pointer", color:"var(--t3)", marginBottom:24, padding:0, fontWeight:600, letterSpacing:"-0.01em" }}>← All Groups</button>

        {/* Header */}
        <div style={{ background:"var(--bg-1)", border:"1px solid var(--border)", borderRadius:"var(--rl)", padding:"26px 30px", marginBottom:24, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg, var(--accent-warm), var(--accent), var(--accent-2))" }} />
          <div style={{ display:"flex", alignItems:"flex-start", gap:18, flexWrap:"wrap" }}>
            <MosaicMark sz={52} color={grp.color||"#1C1917"} />
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:6 }}>
                <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.022em", fontFamily:"var(--serif)" }}>{grp.name}</h1>
                <Badge v="topic">{grp.topic}</Badge>
                <Badge v={grp.privacy}>{grp.privacy==="private"?"Private":"Public"}</Badge>
              </div>
              {grp.description && <p style={{ fontSize:14, color:"var(--t2)", lineHeight:1.6, marginBottom:10 }}>{grp.description}</p>}
              <div style={{ display:"flex", gap:20 }}>
                <span style={{ fontSize:12, color:"var(--t3)", fontWeight:500 }}>{(grp.members||[]).length} members</span>
                <span style={{ fontSize:12, color:"var(--t3)", fontWeight:500 }}>{(grp.appIds||[]).length} apps</span>
                <span style={{ fontSize:12, color:"var(--t3)", fontWeight:500 }}>by {grp.creatorName}</span>
              </div>
            </div>
            {/* Action buttons */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {isCreator(grp) && (
                <>
                  <button onClick={()=>{ setEditForm({name:grp.name, description:grp.description||"", topic:grp.topic||"AI Tools", privacy:grp.privacy||"public", color:grp.color||"#1C1917"}); setShowEdit(true); }} style={{ padding:"8px 16px", background:"var(--bg-0)", border:"1px solid var(--border-h)", borderRadius:"var(--r)", fontSize:13, cursor:"pointer", fontWeight:600, color:"var(--t2)" }}>Edit</button>
                  <button onClick={()=>setConfirmDelete(true)} style={{ padding:"8px 16px", background:"none", border:"1px solid var(--err-border)", borderRadius:"var(--r)", fontSize:13, cursor:"pointer", fontWeight:600, color:"var(--err)" }}>Delete</button>
                </>
              )}
              {!isMember(grp) && grp.privacy==="public" && <button onClick={()=>doJoin(grp)} className="btn-primary-mosaic" style={{ padding:"8px 18px", fontSize:13, borderRadius:"var(--r)" }}>Join</button>}
              {isMember(grp) && !isCreator(grp) && <button onClick={()=>doLeave(grp)} style={{ padding:"8px 16px", background:"none", border:"1px solid var(--border-h)", borderRadius:"var(--r)", fontSize:13, cursor:"pointer", color:"var(--t3)", fontWeight:600 }}>Leave</button>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid var(--border)", marginBottom:24 }}>
          {[{id:"apps",l:`Apps (${(grp.appIds||[]).length})`},{id:"members",l:`Members (${(grp.members||[]).length})`},...(isCreator(grp)?[{id:"settings",l:"Settings"}]:[])].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ padding:"10px 18px", background:"none", border:"none", borderBottom:activeTab===t.id?"2px solid var(--t1)":"2px solid transparent", color:activeTab===t.id?"var(--t1)":"var(--t3)", fontSize:13, fontWeight:activeTab===t.id?700:500, cursor:"pointer", letterSpacing:"-0.01em" }}>{t.l}</button>
          ))}
        </div>

        {/* ── APPS TAB ── */}
        {activeTab==="apps" && (
          <div>
            {isMember(grp) && addable.length>0 && (
              <div style={{ background:"var(--bg-1)", border:"1px solid var(--border)", borderRadius:"var(--rl)", padding:"14px 18px", marginBottom:18 }}>
                <p style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:10, letterSpacing:"0.07em", textTransform:"uppercase" }}>Add your app</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                  {addable.map(b=>(
                    <button key={b.id} onClick={()=>addApp(grp,b.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 14px", background:"var(--bg-0)", border:"1px solid var(--border-h)", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:500 }}>
                      {b.iconUrl?<img src={b.iconUrl} style={{ width:18, height:18, borderRadius:4, objectFit:"cover" }} />:<div style={{ width:18, height:18, borderRadius:4, background:b.accentColor||"var(--accent)" }} />}
                      {b.name}<span style={{ color:"var(--accent)", fontSize:15, fontWeight:700, marginLeft:2 }}>+</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {grpBots.length===0 ? (
              <div style={{ padding:"48px 20px", textAlign:"center", background:"var(--bg-1)", borderRadius:"var(--rl)", border:"1px solid var(--border)" }}>
                <MosaicMark sz={40} color={grp.color||"#1C1917"} />
                <p style={{ fontSize:14, fontWeight:600, marginTop:14, marginBottom:4 }}>No apps yet</p>
                <p style={{ fontSize:12, color:"var(--t3)" }}>Members can add their live apps here.</p>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px,1fr))", gap:12 }}>
                {grpBots.map(bot=>(
                  <div key={bot.id} className="app-card">
                    <div onClick={()=>onBotClick(bot)} style={{ padding:"18px", cursor:"pointer" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                        {bot.iconUrl?<img src={bot.iconUrl} style={{ width:42, height:42, borderRadius:8, objectFit:"cover" }} />:<div style={{ width:42, height:42, borderRadius:8, background:bot.accentColor||"var(--accent)", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px", padding:"7px" }}><div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.95)" }} /><div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.38)" }} /><div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.38)" }} /><div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.95)" }} /></div>}
                        <div><p style={{ fontSize:14, fontWeight:600, letterSpacing:"-0.01em" }}>{bot.name}</p><p style={{ fontSize:11, color:"var(--t3)" }}>{bot.price>0?`$${bot.price}/mo`:"Free"}</p></div>
                      </div>
                      <p style={{ fontSize:12, color:"var(--t2)", lineHeight:1.5, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{bot.tagline}</p>
                    </div>
                    {(isCreator(grp)||(user&&bot.creatorId===user.id)) && (
                      <div style={{ borderTop:"1px solid var(--border)", padding:"8px 18px" }}>
                        <button onClick={()=>removeApp(grp,bot.id)} style={{ fontSize:11, color:"var(--t3)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Remove from group</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MEMBERS TAB ── */}
        {activeTab==="members" && (
          <div style={{ display:"grid", gap:8 }}>
            {(grp.members||[]).map(mid=>(
              <div key={mid} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", background:"var(--bg-1)", border:"1px solid var(--border)", borderRadius:"var(--r)" }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg, var(--accent), var(--accent-2))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"#fff", flexShrink:0 }}>{mid.slice(0,1).toUpperCase()}</div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:600, letterSpacing:"-0.01em" }}>{mid===user?.id?"You":mid===grp.creatorId?grp.creatorName:"Member"}</p>
                  {mid===grp.creatorId && <p style={{ fontSize:11, color:"var(--accent)", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Owner</p>}
                </div>
                {isCreator(grp) && mid!==grp.creatorId && (
                  <button onClick={()=>kickMember(mid)} style={{ padding:"5px 12px", background:"none", border:"1px solid var(--border-h)", borderRadius:5, fontSize:12, cursor:"pointer", color:"var(--t3)", fontWeight:600 }}>Remove</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── SETTINGS TAB (creator only) ── */}
        {activeTab==="settings" && isCreator(grp) && (
          <div style={{ display:"grid", gap:14 }}>
            {/* Invite code management */}
            <div style={{ background:"var(--bg-1)", border:"1px solid var(--border)", borderRadius:"var(--rl)", padding:"20px 24px" }}>
              <p style={{ fontSize:13, fontWeight:700, marginBottom:4, letterSpacing:"-0.01em" }}>Invite Code</p>
              <p style={{ fontSize:13, color:"var(--t3)", marginBottom:14, lineHeight:1.5 }}>Share this code so people can join your private group directly.</p>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontFamily:"var(--mono)", fontWeight:700, fontSize:22, letterSpacing:"0.14em" }}>{grp.inviteCode}</span>
                <button onClick={e=>copyText(grp.inviteCode, e.currentTarget)} style={{ padding:"7px 14px", background:"var(--bg-2)", border:"1px solid var(--border-h)", borderRadius:6, fontSize:12, cursor:"pointer", fontWeight:600, color:"var(--t2)" }}>Copy</button>
                <button onClick={regenerateCode} style={{ padding:"7px 14px", background:"none", border:"1px solid var(--border-h)", borderRadius:6, fontSize:12, cursor:"pointer", fontWeight:600, color:"var(--t3)" }}>Regenerate</button>
              </div>
            </div>

            {/* Edit group */}
            <div style={{ background:"var(--bg-1)", border:"1px solid var(--border)", borderRadius:"var(--rl)", padding:"20px 24px" }}>
              <p style={{ fontSize:13, fontWeight:700, marginBottom:4, letterSpacing:"-0.01em" }}>Group Info</p>
              <p style={{ fontSize:13, color:"var(--t3)", marginBottom:14 }}>Update name, description, topic, or visibility.</p>
              <button onClick={()=>{ setEditForm({name:grp.name, description:grp.description||"", topic:grp.topic||"AI Tools", privacy:grp.privacy||"public", color:grp.color||"#1C1917"}); setShowEdit(true); }} style={{ padding:"9px 18px", background:"var(--t1)", border:"none", borderRadius:"var(--r)", fontSize:13, cursor:"pointer", fontWeight:600, color:"#fff" }}>Edit Group Info</button>
            </div>

            {/* Danger zone */}
            <div style={{ background:"rgba(220,38,38,0.03)", border:"1px solid var(--err-border)", borderRadius:"var(--rl)", padding:"20px 24px" }}>
              <p style={{ fontSize:13, fontWeight:700, marginBottom:4, color:"var(--err)", letterSpacing:"-0.01em" }}>Danger Zone</p>
              <p style={{ fontSize:13, color:"var(--t3)", marginBottom:14, lineHeight:1.5 }}>Permanently delete this group. All members will be removed and this cannot be undone.</p>
              <button onClick={()=>setConfirmDelete(true)} style={{ padding:"9px 18px", background:"var(--err)", border:"none", borderRadius:"var(--r)", fontSize:13, cursor:"pointer", fontWeight:700, color:"#fff" }}>Delete Group</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══ LIST VIEW ════════════════════════════════════════════════════════════
  const visible = groups.filter(g => {
    if (g.privacy==="private" && !g.members?.includes(user?.id)) return false;
    if (!search) return true;
    return g.name.toLowerCase().includes(search.toLowerCase()) || g.topic.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ maxWidth:920, margin:"0 auto", padding:"40px 20px 80px", animation:"fadeUp 0.3s" }}>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"var(--bg-0)", border:"1px solid var(--border)", borderRadius:"var(--rl)", padding:32, width:"100%", maxWidth:460, animation:"scaleIn 0.2s" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <p style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em", fontFamily:"var(--serif)" }}>New Group</p>
              <button onClick={()=>setShowCreate(false)} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"var(--t3)" }}>&times;</button>
            </div>
            <div style={{ display:"grid", gap:16 }}>
              <div>
                <p style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:7, letterSpacing:"0.07em", textTransform:"uppercase" }}>Group Name</p>
                <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Med Spa AI Builders" style={{ width:"100%", padding:"10px 13px", background:"var(--bg-1)", border:"1px solid var(--border-h)", borderRadius:"var(--r)", fontSize:14, outline:"none", color:"var(--t1)", boxSizing:"border-box" }} />
              </div>
              <div>
                <p style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:7, letterSpacing:"0.07em", textTransform:"uppercase" }}>Topic</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {TOPICS.map(t=>(
                    <button key={t} onClick={()=>setForm(p=>({...p,topic:t}))} style={{ padding:"5px 12px", borderRadius:5, border:`1px solid ${form.topic===t?"var(--t1)":"var(--border-h)"}`, background:form.topic===t?"var(--t1)":"none", color:form.topic===t?"#fff":"var(--t2)", fontSize:12, cursor:"pointer", fontWeight:500 }}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:7, letterSpacing:"0.07em", textTransform:"uppercase" }}>Visibility</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {[{id:"public",l:"Public",d:"Anyone can find & join"},{id:"private",l:"Private",d:"Invite code only"}].map(v=>(
                    <div key={v.id} onClick={()=>setForm(p=>({...p,privacy:v.id}))} style={{ padding:"12px 14px", background:form.privacy===v.id?"var(--t1)":"var(--bg-1)", color:form.privacy===v.id?"#fff":"var(--t2)", border:`1px solid ${form.privacy===v.id?"var(--t1)":"var(--border-h)"}`, borderRadius:"var(--r)", cursor:"pointer" }}>
                      <p style={{ fontSize:13, fontWeight:700 }}>{v.l}</p>
                      <p style={{ fontSize:11, opacity:0.65, marginTop:2 }}>{v.d}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:7, letterSpacing:"0.07em", textTransform:"uppercase" }}>Description</p>
                <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="What is this group about?" style={{ width:"100%", padding:"10px 13px", background:"var(--bg-1)", border:"1px solid var(--border-h)", borderRadius:"var(--r)", fontSize:13, minHeight:68, resize:"vertical", outline:"none", color:"var(--t1)", lineHeight:1.6, fontFamily:"var(--sans)", boxSizing:"border-box" }} />
              </div>
              <div>
                <p style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:9, letterSpacing:"0.07em", textTransform:"uppercase" }}>Group Color</p>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:46, height:46, display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"1fr 1fr", gap:"3px", padding:"8px", background:form.color||"#1C1917", borderRadius:10, flexShrink:0, transition:"all 0.2s", boxShadow:"0 2px 10px rgba(0,0,0,0.2)" }}>
                    <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.96)" }} />
                    <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.36)" }} />
                    <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.36)" }} />
                    <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.96)" }} />
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, flex:1 }}>
                    {["#1C1917","#7C6FCD","#C07A5A","#C9A84C","#0F766E","#1D4ED8","#7C3AED","#BE123C","#065F46","#1E3A5F"].map(c => (
                      <div key={c} onClick={() => setForm(p => ({...p, color:c}))} style={{ width:24, height:24, borderRadius:5, background:c, cursor:"pointer", outline:(form.color||"#1C1917")===c?"2.5px solid rgba(0,0,0,0.4)":"2.5px solid transparent", outlineOffset:1, transition:"transform 0.1s", transform:(form.color||"#1C1917")===c?"scale(1.2)":"scale(1)" }} />
                    ))}
                    <label style={{ width:24, height:24, borderRadius:5, border:"1.5px dashed var(--border-h)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"var(--t3)", overflow:"hidden", position:"relative" }}>
                      +
                      <input type="color" value={form.color||"#1C1917"} onChange={e => setForm(p => ({...p, color:e.target.value}))} style={{ position:"absolute", opacity:0, width:"100%", height:"100%", cursor:"pointer" }} />
                    </label>
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", gap:8, paddingTop:4 }}>
                <button onClick={()=>setShowCreate(false)} style={{ flex:1, padding:"11px", background:"var(--bg-1)", border:"1px solid var(--border)", borderRadius:"var(--r)", fontSize:13, cursor:"pointer", fontWeight:600, color:"var(--t2)" }}>Cancel</button>
                <button onClick={createGroup} disabled={!form.name.trim()||saving} className="btn-primary-mosaic" style={{ flex:2, padding:"11px", fontSize:13, borderRadius:"var(--r)", opacity:!form.name.trim()?0.5:1 }}>{saving?"Creating...":"Create Group"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:32, flexWrap:"wrap" }}>
        <div>
          <h1 style={{ fontFamily:"var(--serif)", fontSize:30, fontWeight:500, letterSpacing:"-0.025em", marginBottom:5 }}>Groups</h1>
          <p style={{ fontSize:14, color:"var(--t3)" }}>Communities built around AI tools and projects.</p>
        </div>
        <button onClick={()=>user?setShowCreate(true):onAuth()} className="btn-primary-mosaic" style={{ padding:"10px 20px", fontSize:13, borderRadius:"var(--r)", flexShrink:0 }}>New Group</button>
      </div>

      {/* Join by code */}
      {user && (
        <div style={{ display:"flex", gap:8, marginBottom:20 }}>
          <input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="Enter invite code to join a private group" style={{ flex:1, padding:"10px 14px", background:"var(--bg-1)", border:"1px solid var(--border-h)", borderRadius:"var(--r)", fontSize:13, outline:"none", color:"var(--t1)" }} />
          <button onClick={joinByCode} disabled={!joinCode.trim()} style={{ padding:"10px 18px", background:"var(--t1)", color:"#fff", border:"none", borderRadius:"var(--r)", fontSize:13, fontWeight:600, cursor:"pointer", opacity:!joinCode.trim()?0.4:1 }}>Join</button>
        </div>
      )}

      {/* Search */}
      <div style={{ position:"relative", marginBottom:24 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search groups..." style={{ width:"100%", padding:"10px 16px 10px 40px", background:"var(--bg-1)", border:"1px solid var(--border-h)", borderRadius:"var(--r)", fontSize:14, outline:"none", color:"var(--t1)", boxSizing:"border-box" }} />
        <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"var(--t3)", fontSize:15 }}>⌕</span>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"var(--t3)", fontSize:13 }}>Loading...</div>
      ) : visible.length===0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px", background:"var(--bg-1)", borderRadius:"var(--rl)", border:"1px solid var(--border)" }}>
          <div style={{ width:44, height:44, margin:"0 auto 14px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px", padding:"8px", background:"var(--bg-2)", borderRadius:10 }}><div style={{ borderRadius:"1px", background:"var(--border-h)" }} /><div style={{ borderRadius:"1px", background:"var(--border-h)", opacity:0.5 }} /><div style={{ borderRadius:"1px", background:"var(--border-h)", opacity:0.5 }} /><div style={{ borderRadius:"1px", background:"var(--border-h)" }} /></div>
          <p style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>No groups yet</p>
          <p style={{ fontSize:13, color:"var(--t3)", marginBottom:18 }}>Be the first to create one.</p>
          <button onClick={()=>user?setShowCreate(true):onAuth()} className="btn-primary-mosaic" style={{ padding:"10px 22px", fontSize:13, borderRadius:"var(--r)" }}>Create Group</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px,1fr))", gap:14 }}>
          {visible.map((grp,idx)=>(
            <div key={grp.id} className="app-card" onClick={()=>openGroup(grp)} style={{ padding:"22px", animation:`fadeUp 0.3s ease ${idx*0.04}s both`, cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:14 }}>
                <MosaicMark sz={44} color={grp.color||"#1C1917"} />
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:15, fontWeight:700, letterSpacing:"-0.01em", marginBottom:6 }}>{grp.name}</p>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    <Badge v="topic">{grp.topic}</Badge>
                    <Badge v={grp.privacy}>{grp.privacy==="private"?"Private":"Public"}</Badge>
                    {isMember(grp) && <span style={{ fontSize:10, padding:"2px 8px", background:"rgba(124,111,205,0.08)", border:"1px solid rgba(124,111,205,0.2)", borderRadius:4, color:"var(--accent)", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>Joined</span>}
                    {isCreator(grp) && <span style={{ fontSize:10, padding:"2px 8px", background:"var(--bg-2)", border:"1px solid var(--border)", borderRadius:4, color:"var(--t3)", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>Owner</span>}
                  </div>
                </div>
              </div>
              {grp.description && <p style={{ fontSize:13, color:"var(--t2)", lineHeight:1.55, marginBottom:14, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{grp.description}</p>}
              <div style={{ display:"flex", gap:16, paddingTop:12, borderTop:"1px solid var(--border)" }}>
                <span style={{ fontSize:11, color:"var(--t3)", fontWeight:500 }}>{(grp.members||[]).length} members</span>
                <span style={{ fontSize:11, color:"var(--t3)", fontWeight:500 }}>{(grp.appIds||[]).length} apps</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- USER PROFILE PAGE ---
function StripeStatusSection({ user, onNav }) {
  const [profileStripe, setProfileStripe] = useState(null);
  useEffect(() => {
    if (user.stripeAccountId) {
      fetch(`/api/connect-status?accountId=${user.stripeAccountId}`)
        .then(r => r.json()).then(d => { if (d.accountId) setProfileStripe(d); }).catch(() => {});
    }
  }, [user.stripeAccountId]);
  const connected = profileStripe?.chargesEnabled && profileStripe?.payoutsEnabled;

  return connected ? (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", background:"rgba(5,150,105,0.07)", border:"1px solid rgba(5,150,105,0.2)", borderRadius:"var(--r)", marginBottom:16 }}>
        <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(5,150,105,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"var(--ok)", flexShrink:0 }}>✓</div>
        <div>
          <p style={{ fontSize:14, fontWeight:700, color:"#065F46", letterSpacing:"-0.01em" }}>Stripe account connected</p>
          <p style={{ fontSize:12, color:"#047857" }}>Payouts deposited weekly to your bank account</p>
        </div>
      </div>
      <InfoRow label="Stripe Account ID" value={user.stripeAccountId} mono />
      <InfoRow label="Payout Schedule" value="Weekly (every Monday)" />
      <InfoRow label="Platform Fee" value="15% per transaction" />
      <div style={{ marginTop:16, display:"flex", gap:8 }}>
        <Btn v="secondary" sz="sm" onClick={() => window.open("https://dashboard.stripe.com", "_blank")}>Open Stripe Dashboard ↗</Btn>
        <Btn v="ghost" sz="sm" onClick={() => onNav("dashboard")}>Go to Dashboard</Btn>
      </div>
    </div>
  ) : (
    <div>
      {user.stripeAccountId && !connected && (
        <div style={{ padding:"12px 14px", background:"var(--warn-bg)", border:"1px solid #FED7AA", borderRadius:"var(--r)", marginBottom:14 }}>
          <p style={{ fontSize:13, fontWeight:600, color:"#9A3412" }}>Stripe onboarding incomplete</p>
          <p style={{ fontSize:12, color:"#C2410C", marginTop:2 }}>Finish setting up your Stripe account to enable payouts.</p>
        </div>
      )}
      <p style={{ fontSize:14, color:"var(--t2)", marginBottom:6, lineHeight:1.6 }}>Connect a bank account to receive payouts. You will receive 85% of every subscription deposited weekly.</p>
      <p style={{ fontSize:12, color:"var(--t3)", marginBottom:16 }}>Powered by Stripe Connect. Takes about 5 minutes.</p>
      <div style={{ display:"grid", gap:8, marginBottom:16 }}>
        {[
          { l:"Your Cut", v:"85% — deposited every Monday" },
          { l:"Platform Fee", v:"15% — covers infrastructure & payments" },
          { l:"Countries", v:"US, UK, EU, Canada, Australia, 40+ more" },
        ].map(r => (
          <div key={r.l} style={{ padding:"10px 14px", background:"var(--bg-2)", borderRadius:"var(--r)", display:"flex", justifyContent:"space-between", gap:10 }}>
            <p style={{ fontSize:12, fontWeight:700 }}>{r.l}</p>
            <p style={{ fontSize:12, color:"var(--t2)" }}>{r.v}</p>
          </div>
        ))}
      </div>
      <Btn onClick={() => onNav("dashboard")}>Set Up Payouts →</Btn>
    </div>
  );
}

function ProfilePage({ user, setCurrentUser, users, setUsers, bots, onNav }) {
  const [tab, setTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [company, setCompany] = useState(user?.company || "");
  const [website, setWebsite] = useState(user?.website || "");
  const [twitter, setTwitter] = useState(user?.twitter || "");
  const [showName, setShowName] = useState(user?.showCreatorName !== false);
  const [saving, setSaving] = useState(false);

  if (!user) return <div style={{ padding: "80px 20px", textAlign: "center" }}><p style={{ color: "var(--t3)" }}>Sign in to view your profile</p></div>;

  const userBots = bots.filter(b => b.creatorId === user.id);
  const totalRevenue = userBots.reduce((s, b) => s + ((b.price || 0) * (b.downloads || 0) * 0.85), 0);
  const totalDownloads = userBots.reduce((s, b) => s + (b.downloads || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    const updated = { ...user, name, bio, company, website, twitter, showCreatorName: showName };
    await DB.saveUser(updated);
    setCurrentUser(updated);
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    Session.save(updated);
    setEditing(false);
    setSaving(false);
  };

  const SectionLabel = ({ color, children }) => (
    <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--t3)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 4, height: 14, background: color || "var(--accent)", borderRadius: 2, display: "inline-block" }} />
      {children}
    </p>
  );

  const InfoRow = ({ label, value, mono }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <span style={{ color: "var(--t3)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontWeight: 600, fontFamily: mono ? "var(--mono)" : "var(--sans)", fontSize: mono ? 12 : 13 }}>{value || "—"}</span>
    </div>
  );

  const tabs = [
    { id: "profile", l: "Profile" },
    { id: "billing", l: "Billing" },
    { id: "creator", l: "Creator Fund" },
    { id: "security", l: "Security" },
  ];

  return (
    <div className="mob-pad" style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px 80px", animation: "fadeUp 0.3s" }}>

      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent-2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff", flexShrink: 0, boxShadow: "0 4px 16px rgba(91,92,246,0.3)" }}>{(user.name || "?")[0]}</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 2 }}>{user.name}</h1>
          <p style={{ fontSize: 13, color: "var(--t3)" }}>{user.email} · Member since {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}</p>
          {user.bio && <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 4, lineHeight: 1.5 }}>{user.bio}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 24, gap: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "9px 16px", background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? "var(--t1)" : "transparent"}`, color: tab === t.id ? "var(--t1)" : "var(--t3)", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", transition: "all 0.15s" }}>{t.l}</button>
        ))}
      </div>

      {/* PROFILE TAB */}
      {tab === "profile" && (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { l: "Apps Created", v: userBots.length },
              { l: "Total Downloads", v: totalDownloads },
              { l: "Lifetime Earnings", v: "$" + totalRevenue.toFixed(0) },
            ].map(s => (
              <div key={s.l} className="stat-tile" style={{ textAlign: "center" }}>
                <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 3 }}>{s.v}</p>
                <p style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.l}</p>
              </div>
            ))}
          </div>

          {/* Edit form */}
          <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <SectionLabel color="var(--accent)">Personal Information</SectionLabel>
              {!editing && <Btn v="secondary" sz="sm" onClick={() => setEditing(true)}>Edit Profile</Btn>}
            </div>
            <div style={{ padding: "16px 20px", display: "grid", gap: editing ? 12 : 0 }}>
              {editing ? (
                <>
                  <Field label="Display Name"><Inp value={name} onChange={e => setName(e.target.value)} /></Field>
                  <Field label="Bio" note="Shown on your public profile">
                    <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell people about yourself..." style={{ width: "100%", padding: "9px 12px", background: "var(--bg-0)", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 14, resize: "vertical", minHeight: 70, outline: "none", color: "var(--t1)", fontFamily: "var(--sans)" }} />
                  </Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="Company / Organization"><Inp value={company} onChange={e => setCompany(e.target.value)} placeholder="Optional" /></Field>
                    <Field label="Website"><Inp type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" /></Field>
                  </div>
                  <Field label="Twitter / X"><Inp value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="@handle" /></Field>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--t2)", cursor: "pointer", padding: "4px 0" }}>
                    <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} style={{ accentColor: "var(--accent)", width: 14, height: 14 }} />
                    Show my name on apps I create
                    <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: 2 }}>(off = "Anonymous")</span>
                  </label>
                  <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                    <Btn sz="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Btn>
                    <Btn v="secondary" sz="sm" onClick={() => { setEditing(false); setName(user.name); setBio(user.bio || ""); setCompany(user.company || ""); setWebsite(user.website || ""); setTwitter(user.twitter || ""); setShowName(user.showCreatorName !== false); }}>Cancel</Btn>
                  </div>
                </>
              ) : (
                <>
                  <InfoRow label="Display Name" value={user.name} />
                  <InfoRow label="Email" value={user.email} />
                  <InfoRow label="Company" value={user.company} />
                  <InfoRow label="Website" value={user.website} />
                  <InfoRow label="Twitter / X" value={user.twitter} />
                  <InfoRow label="Creator name visible" value={user.showCreatorName !== false ? "Visible" : "Hidden"} />
                  <InfoRow label="Account type" value={isAdmin(user) ? "Admin" : "Creator"} />
                </>
              )}
            </div>
          </div>

          {/* Your Apps */}
          {userBots.length > 0 && (
            <div>
              <SectionLabel color="var(--accent-2)">Your Apps</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {userBots.map(b => (
                  <div key={b.id} onClick={() => onNav("detail", b)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseOver={e => e.currentTarget.style.borderColor = "var(--accent)"} onMouseOut={e => e.currentTarget.style.borderColor = "var(--border)"}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: b.accentColor || "#1C1917", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "2px", padding: "6px", flexShrink: 0 }}>
                      {b.iconUrl ? <img src={b.iconUrl} style={{ width: "400%", height: "400%", objectFit: "cover", borderRadius: 6, transform: "translate(-75%,-75%)" }} /> : <>
                        <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.95)" }} /><div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.45)" }} />
                        <div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.45)" }} /><div style={{ borderRadius: "2px", background: "rgba(255,255,255,0.95)" }} />
                      </>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</p>
                      <p style={{ fontSize: 11, color: "var(--t3)" }}>{b.category} · {b.price > 0 ? "$" + b.price + "/mo" : "Free"}</p>
                    </div>
                    <Bdg v={b.status === "approved" ? "ok" : b.status === "pending" ? "warn" : "err"}>{b.status}</Bdg>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BILLING TAB */}
      {tab === "billing" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <SectionLabel color="var(--ok)">Payment Method</SectionLabel>
            </div>
            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "var(--bg-2)", borderRadius: "var(--r)", marginBottom: 14 }}>
                <div style={{ width: 42, height: 28, background: "linear-gradient(135deg, #1a1a2e, #16213e)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, padding: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 1, background: "rgba(255,255,255,0.8)" }} />
                    <div style={{ width: 6, height: 6, borderRadius: 1, background: "rgba(255,255,255,0.4)" }} />
                    <div style={{ width: 6, height: 6, borderRadius: 1, background: "rgba(255,255,255,0.4)" }} />
                    <div style={{ width: 6, height: 6, borderRadius: 1, background: "rgba(255,255,255,0.8)" }} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>No payment method on file</p>
                  <p style={{ fontSize: 11, color: "var(--t3)" }}>Add a card to subscribe to paid apps</p>
                </div>
                <Btn sz="sm">Add Card</Btn>
              </div>
              <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.6 }}>Payments are processed securely by Stripe. Mosaic never stores your full card details. All subscriptions auto-renew monthly until cancelled.</p>
            </div>
          </div>

          <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <SectionLabel color="var(--warn)">Active Subscriptions</SectionLabel>
            </div>
            <div style={{ padding: "20px" }}>
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ fontSize: 14, color: "var(--t2)", marginBottom: 8 }}>No active subscriptions</p>
                <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 16 }}>When you subscribe to paid apps, they'll appear here.</p>
                <Btn v="secondary" sz="sm" onClick={() => onNav("home")}>Browse Apps</Btn>
              </div>
            </div>
          </div>

          <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <SectionLabel color="var(--t3)">Billing History</SectionLabel>
            </div>
            <div style={{ padding: "20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--t3)" }}>No transactions yet</p>
            </div>
          </div>
        </div>
      )}

      {/* CREATOR FUND TAB */}
      {tab === "creator" && (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Earnings summary */}
          <div style={{ background: "linear-gradient(135deg, var(--t1) 0%, #2d2b4e 100%)", borderRadius: "var(--rl)", padding: "24px 20px", color: "#fff", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 16, right: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, opacity: 0.12 }}>
              {[...Array(9)].map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: "#fff" }} />)}
            </div>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.6, marginBottom: 8 }}>Creator Fund Balance</p>
            <p style={{ fontFamily: "var(--serif)", fontSize: 38, fontWeight: 600, letterSpacing: "-0.03em", marginBottom: 4 }}>${totalRevenue.toFixed(2)}</p>
            <p style={{ fontSize: 12, opacity: 0.6 }}>Lifetime earnings · 85% of all sales</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { l: "This Month", v: "$0.00", sub: "No sales yet" },
              { l: "Pending Payout", v: "$0.00", sub: "Paid weekly via Stripe" },
            ].map(s => (
              <div key={s.l} className="stat-tile">
                <p style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{s.l}</p>
                <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 2 }}>{s.v}</p>
                <p style={{ fontSize: 11, color: "var(--t3)" }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Bank Account */}
          <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <SectionLabel color="var(--ok)">Bank Account / Payout Method</SectionLabel>
            </div>
            <div style={{ padding: "20px" }}>
              <StripeStatusSection user={user} onNav={onNav} />
            </div>
          </div>

          {/* Payout history */}
          <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <SectionLabel color="var(--t3)">Payout History</SectionLabel>
            </div>
            <div style={{ padding: "20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--t3)" }}>No payouts yet — start selling to see earnings here</p>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY TAB */}
      {tab === "security" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <SectionLabel color="var(--err)">Account Security</SectionLabel>
            </div>
            <div style={{ padding: "20px", display: "grid", gap: 0 }}>
              <InfoRow label="Email" value={user.email} />
              <InfoRow label="Login Method" value={user.googleUid ? "Google" : "Email & Password"} />
              <InfoRow label="Account ID" value={user.id} mono />
              <InfoRow label="Last Sign In" value="—" />
            </div>
          </div>

          <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <SectionLabel color="var(--t3)">Data & Privacy</SectionLabel>
            </div>
            <div style={{ padding: "20px", display: "grid", gap: 10 }}>
              <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>You can request a full export of your data or permanently delete your account at any time. Deletion removes all your listings, reviews, and personal information.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn v="secondary" sz="sm" onClick={() => alert("Data export requested. You'll receive an email within 48 hours.")}>Request Data Export</Btn>
                <Btn v="danger" sz="sm" onClick={() => alert("Contact support@mosaicbots.com to delete your account.")}>Delete Account</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- REVIEW SYSTEM ---
function ReviewSection({ botId, user, onAuth }) {
  const [reviews, setReviews] = useState([]);
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "reviews_" + botId));
        setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {}
      setLoaded(true);
    })();
  }, [botId]);

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "0";

  const submitReview = async () => {
    if (!user) { onAuth("signup"); return; }
    if (rating === 0) return;
    setSubmitting(true);
    const review = { id: "rev_" + Date.now(), userId: user.id, userName: user.name, userAvatar: user.avatarUrl || null, rating, text: text.trim(), createdAt: new Date().toISOString() };
    try {
      await setDoc(doc(db, "reviews_" + botId, review.id), review);
      setReviews(prev => [review, ...prev]);
      setWriting(false); setRating(0); setText("");
    } catch {}
    setSubmitting(false);
  };

  const StarRow = ({ value, onSet, onHover, size }) => (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} onClick={() => onSet && onSet(s)} onMouseOver={() => onHover && onHover(s)} onMouseOut={() => onHover && onHover(0)}
          style={{ fontSize: size || 18, cursor: onSet ? "pointer" : "default", color: s <= (onHover ? (hoverRating || value) : value) ? "#F59E0B" : "#D1D5DB", transition: "color 0.1s" }}>&#9733;</span>
      ))}
    </div>
  );

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--rl)", padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Ratings & Reviews</h3>
        {user && !writing && <Btn v="secondary" sz="sm" onClick={() => setWriting(true)}>Write Review</Btn>}
      </div>

      {/* SUMMARY */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{avgRating}</p>
          <StarRow value={Math.round(avgRating)} size={14} />
          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* WRITE REVIEW */}
      {writing && (
        <div style={{ padding: "14px", background: "var(--bg-0)", borderRadius: "var(--r)", marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Your rating</p>
          <StarRow value={rating} onSet={setRating} onHover={setHoverRating} size={24} />
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write your review (optional)..." style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-h)", borderRadius: "var(--r)", fontSize: 13, resize: "vertical", minHeight: 60, outline: "none", marginTop: 10, color: "var(--t1)" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Btn sz="sm" onClick={submitReview} disabled={submitting || rating === 0}>{submitting ? "Submitting..." : "Submit"}</Btn>
            <Btn v="secondary" sz="sm" onClick={() => { setWriting(false); setRating(0); setText(""); }}>Cancel</Btn>
          </div>
        </div>
      )}

      {/* REVIEWS LIST */}
      {reviews.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {reviews.slice(0, 10).map(r => (
            <div key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                {r.userAvatar ? <img src={r.userAvatar} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} /> : <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{(r.userName||"?")[0]}</div>}
                <span style={{ fontSize: 13, fontWeight: 600 }}>{r.userName}</span>
                <StarRow value={r.rating} size={12} />
                <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: "auto" }}>{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              {r.text && <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5 }}>{r.text}</p>}
            </div>
          ))}
        </div>
      ) : !writing && (
        <p style={{ fontSize: 13, color: "var(--t3)", textAlign: "center", padding: "8px 0" }}>No reviews yet. Be the first!</p>
      )}
    </div>
  );
}

// --- MAIN APP ---

// ─── APP TOUR ────────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Mosaic",
    body: "Mosaic is a marketplace for AI-powered tools and apps — built by real developers, sold directly to users. Let's take a quick look around.",
    target: null,
  },
  {
    id: "explore",
    title: "Explore",
    body: "Browse the full catalog of AI apps and tools. Filter by category, search by keyword, or jump into the Multiplayer section for real-time collaborative experiences.",
    target: null,
    nav: "home",
  },
  {
    id: "groups",
    title: "Groups",
    body: "Join or create communities around specific tools or topics. Members can share apps, collaborate, and invite others via private invite codes.",
    target: null,
    nav: "groups",
  },
  {
    id: "create",
    title: "Create & Sell",
    body: "Upload a single HTML file to list your app. Set a price, choose a session type, and submit for review. Mosaic auto-injects Firebase and AI keys — you keep 85% of every sale.",
    target: null,
    nav: "submit",
  },
  {
    id: "myapps",
    title: "My Apps",
    body: "Every app you subscribe to lives here. Launch apps, manage your subscriptions, and keep everything in one place.",
    target: null,
    nav: "myapps",
  },
  {
    id: "dashboard",
    title: "Creator Dashboard",
    body: "Track installs, subscribers, and live users across all your apps. Connect Stripe once to enable automatic weekly payouts.",
    target: null,
    nav: "dashboard",
  },
  {
    id: "done",
    title: "You're all set",
    body: "That's the full tour. Explore the marketplace, build something, or join a group to get started. You can replay this anytime from the bottom of any page.",
    target: null,
  },
];

function AppTour({ onClose, onNav, user }) {
  const [step, setStep] = useState(0);
  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  const isFirst = step === 0;

  const next = () => {
    const nextStep = TOUR_STEPS[step + 1];
    if (nextStep?.nav) {
      if (nextStep.nav === "dashboard" && !user) { setStep(step + 1); return; }
      if (nextStep.nav === "myapps" && !user) { setStep(step + 1); return; }
      onNav(nextStep.nav);
    }
    setStep(s => s + 1);
  };

  const prev = () => {
    const prevStep = TOUR_STEPS[step - 1];
    if (prevStep?.nav) onNav(prevStep.nav);
    else onNav("home");
    setStep(s => s - 1);
  };

  const finish = () => {
    localStorage.setItem("mosaic_toured", "1");
    onClose();
    onNav("home");
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:99999, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 20px 32px", pointerEvents:"none" }}>
      {/* Backdrop — just dim, not block */}
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(2px)", pointerEvents:"auto" }} onClick={finish} />

      {/* Tour card */}
      <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:500, background:"var(--bg-0)", border:"1px solid var(--border)", borderRadius:"var(--rl)", boxShadow:"0 24px 64px rgba(0,0,0,0.18)", animation:"fadeUp 0.3s ease both", pointerEvents:"auto", overflow:"hidden" }}>
        {/* Accent bar */}
        <div style={{ height:3, background:"linear-gradient(90deg, var(--accent-warm), var(--accent), var(--accent-2))" }} />

        {/* Progress dots */}
        <div style={{ display:"flex", gap:5, padding:"16px 24px 0" }}>
          {TOUR_STEPS.map((_,i) => (
            <div key={i} style={{ height:2, flex:1, borderRadius:2, background:i<=step?"var(--t1)":"var(--border)", transition:"background 0.3s" }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ padding:"20px 24px 24px" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:16 }}>
            <div style={{ width:40, height:40, borderRadius:9, background:"var(--t1)", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2.5px", padding:"7px", flexShrink:0, animation:"tileReveal 0.4s ease both" }}>
              <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.95)" }} />
              <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.35)" }} />
              <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.35)" }} />
              <div style={{ borderRadius:"1px", background:"rgba(255,255,255,0.95)" }} />
            </div>
            <div>
              <p style={{ fontSize:11, fontWeight:700, color:"var(--t3)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>Step {step+1} of {TOUR_STEPS.length}</p>
              <h3 style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em", fontFamily:"var(--serif)", lineHeight:1.2 }}>{current.title}</h3>
            </div>
          </div>
          <p style={{ fontSize:14, color:"var(--t2)", lineHeight:1.7, marginBottom:20 }}>{current.body}</p>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
            <button onClick={finish} style={{ fontSize:12, color:"var(--t3)", background:"none", border:"none", cursor:"pointer", fontWeight:500, padding:0 }}>Skip tour</button>
            <div style={{ display:"flex", gap:8 }}>
              {!isFirst && <button onClick={prev} style={{ padding:"9px 18px", background:"var(--bg-1)", border:"1px solid var(--border)", borderRadius:"var(--r)", fontSize:13, cursor:"pointer", fontWeight:600, color:"var(--t2)" }}>← Back</button>}
              <button onClick={isLast ? finish : next} className="btn-primary-mosaic" style={{ padding:"9px 22px", fontSize:13, borderRadius:"var(--r)" }}>{isLast ? "Get started →" : "Next →"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [bots, setBots] = useState([]);
  const [users, setUsers] = useState([]);
  const [admin, setAdmin] = useState({ email: "support@mosaicbots.com", platformFee: 15 });
  const [currentUser, setCurrentUserRaw] = useState(null);
  const [selectedBot, setSelectedBot] = useState(null);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState("signin");
  const [dlOpen, setDlOpen] = useState(false);
  const [dlBot, setDlBot] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const setCurrentUser = (u) => {
    setCurrentUserRaw(u);
    if (u) Session.save(u); else Session.clear();
  };

  useEffect(() => {
    (async () => {
      const [b, u, a] = await Promise.all([DB.getBots(), DB.getUsers(), DB.getAdmin()]);

      // Seed starter apps if they don't exist yet
      const starterIds = [];
      const existingIds = b.map(x => x.id);
      const starters = [];
      const missing = starters.filter(s => !existingIds.includes(s.id));
      if (missing.length > 0) {
        for (const bot of missing) await DB.saveBot(bot);
        setBots([...b, ...missing]);
      } else {
        setBots(b);
      }
      setUsers(u); setAdmin(a);
      // Restore session
      const saved = Session.load();
      if (saved) {
        // Verify user still exists in DB
        const dbUser = u.find(x => x.id === saved.id);
        if (dbUser) setCurrentUserRaw(dbUser);
        else Session.clear();
      }
      setLoaded(true);
      // Show tour on first visit
      if (!localStorage.getItem("mosaic_toured")) {
        setTimeout(() => setTourOpen(true), 800);
      }

      // Handle purchase return from Stripe
      const params = new URLSearchParams(window.location.search);
      const purchasedBot = params.get("purchased");
      if (purchasedBot && saved) {
        try {
          const existing = JSON.parse(localStorage.getItem("mb_subs_" + saved.id) || "[]");
          if (!existing.includes(purchasedBot)) {
            existing.push(purchasedBot);
            localStorage.setItem("mb_subs_" + saved.id, JSON.stringify(existing));
          }
        } catch {}
        window.history.replaceState({}, "", window.location.pathname);
      }
    })();
  }, []);

  const nav = v => {
    window.history.pushState({ view: v }, "", "/" + (v === "home" ? "" : v));
    setView(v); setSelectedBot(null); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openAuth = t => { setAuthTab(t); setAuthOpen(true); };

  useEffect(() => {
    // Handle browser back/forward
    const onPop = (e) => {
      const v = e.state?.view || "home";
      setView(v); setSelectedBot(null); window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onPop);
    // Set initial history entry so first back press stays on home
    window.history.replaceState({ view: "home" }, "", "/");
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const handler = (e) => { nav(e.detail); setAuthOpen(false); };
    window.addEventListener("mosaicNav", handler);
    return () => window.removeEventListener("mosaicNav", handler);
  }, []);

  if (!loaded) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-0)" }}><style>{CSS}</style><p style={{ color: "var(--t3)", fontSize: 14 }}>Loading...</p></div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)" }}>
      <style>{CSS}</style>
      <Nav onNav={nav} view={view} user={currentUser} onAuth={openAuth} onSignOut={() => setCurrentUser(null)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} tab={authTab} users={users} setUsers={setUsers} setCurrentUser={setCurrentUser} />
      <DlModal isOpen={dlOpen} onClose={() => setDlOpen(false)} bot={dlBot} />

      {view === "groups" && <GroupsPage bots={bots} user={currentUser} onAuth={openAuth} onBotClick={b => { setSelectedBot(b); setView("detail"); window.scrollTo({ top: 0 }); }} />}
      {view === "home" && <HomePage bots={bots} search={search} setSearch={setSearch} cat={cat} setCat={setCat} onBotClick={b => { setSelectedBot(b); setView("detail"); window.scrollTo({ top: 0 }); }} />}
      {view === "detail" && selectedBot && <BotDetailPage bot={selectedBot} onBack={() => nav("home")} onDownload={() => { setDlBot(selectedBot); setDlOpen(true); }} onAuth={openAuth} user={currentUser} users={users} onOpenApp={b => { setSelectedBot(b); setView("useapp"); }} onViewProfile={cId => { setSelectedBot({ creatorId: cId }); setView("viewprofile"); }} />}
      {view === "submit" && <SubmitPage user={currentUser} onAuth={openAuth} bots={bots} setBots={setBots} />}
      {view === "dashboard" && currentUser && <CreatorDashboard user={currentUser} bots={bots} setBots={setBots} users={users} setUsers={setUsers} />}
      {view === "myapps" && !selectedBot && currentUser && <MySubscriptions user={currentUser} bots={bots} onNav={nav} onOpenApp={b => { setSelectedBot(b); setView("useapp"); }} />}
      {view === "useapp" && selectedBot && currentUser && <AppViewer bot={selectedBot} onBack={() => { setView("myapps"); setSelectedBot(null); }} user={currentUser} />}
      {view === "admin" && isAdmin(currentUser) && <AdminPage bots={bots} setBots={setBots} users={users} admin={admin} />}
      {view === "profile" && currentUser && <ProfilePage user={currentUser} setCurrentUser={setCurrentUser} users={users} setUsers={setUsers} bots={bots} onNav={(v, b) => { if (b) { setSelectedBot(b); setView("detail"); } else nav(v); }} />}
      {view === "docs" && <DocsPage onNav={nav} />}
      {view === "privacy" && <PrivacyPage />}
      {view === "terms" && <TermsPage />}
      {view === "about" && <AboutPage onNav={nav} />}
      {view === "contact" && <ContactPage admin={admin} />}

      <Footer onNav={nav} onTour={() => setTourOpen(true)} />
      {tourOpen && <AppTour onClose={() => setTourOpen(false)} onNav={nav} user={currentUser} />}
    </div>
  );
}
