// POST /api/notify
// Sends notification emails via Resend
// Body: { type: "approved"|"purchased"|"welcome", to, data }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: "API key not configured" });

  const { type, to, data } = req.body || {};
  if (!type || !to) return res.status(400).json({ error: "Missing type or to" });

  const templates = {
    approved: {
      subject: `Your bot "${data?.botName}" is now live on Mosaic!`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px">
          <div style="margin-bottom:24px"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:28px;height:28px;background:#1A1816;border-radius:7px;text-align:center;vertical-align:middle;color:#fff;font-weight:700;font-size:13px;font-family:monospace">M</td><td style="padding-left:8px;font-size:16px;font-weight:700;letter-spacing:-0.03em">Mosaic</td></tr></table></div>
          <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;color:#1A1816">Your bot is live! 🎉</h1>
          <p style="font-size:15px;color:#5C5954;line-height:1.6;margin:0 0 16px"><strong>${data?.botName || "Your bot"}</strong> has been approved and is now listed on the Mosaic marketplace.</p>
          <p style="font-size:14px;color:#5C5954;line-height:1.6;margin:0 0 24px">Buyers can now discover, subscribe to, and download your bot. Make sure you've connected Stripe to receive your earnings.</p>
          <a href="https://mosaicbots.com" style="display:inline-block;padding:10px 24px;background:#1A1816;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">View your dashboard</a>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E6E1"><p style="font-size:11px;color:#9C9890;margin:0">Mosaic — AI Bot Marketplace<br>mosaicbots.com</p></div>
        </div>`,
    },
    purchased: {
      subject: `New subscriber for "${data?.botName}" on Mosaic`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px">
          <div style="margin-bottom:24px"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:28px;height:28px;background:#1A1816;border-radius:7px;text-align:center;vertical-align:middle;color:#fff;font-weight:700;font-size:13px;font-family:monospace">M</td><td style="padding-left:8px;font-size:16px;font-weight:700;letter-spacing:-0.03em">Mosaic</td></tr></table></div>
          <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;color:#1A1816">New sale! 💰</h1>
          <p style="font-size:15px;color:#5C5954;line-height:1.6;margin:0 0 16px">Someone just subscribed to <strong>${data?.botName || "your bot"}</strong> for <strong>$${data?.price || "0"}/mo</strong>.</p>
          <p style="font-size:14px;color:#5C5954;line-height:1.6;margin:0 0 24px">Your 85% share ($${data?.creatorShare || "0"}) will be deposited to your connected Stripe account.</p>
          <a href="https://mosaicbots.com" style="display:inline-block;padding:10px 24px;background:#1A1816;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">View dashboard</a>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E6E1"><p style="font-size:11px;color:#9C9890;margin:0">Mosaic — AI Bot Marketplace<br>mosaicbots.com</p></div>
        </div>`,
    },
    welcome: {
      subject: "Welcome to Mosaic!",
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px">
          <div style="margin-bottom:24px"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:28px;height:28px;background:#1A1816;border-radius:7px;text-align:center;vertical-align:middle;color:#fff;font-weight:700;font-size:13px;font-family:monospace">M</td><td style="padding-left:8px;font-size:16px;font-weight:700;letter-spacing:-0.03em">Mosaic</td></tr></table></div>
          <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;color:#1A1816">Welcome to Mosaic</h1>
          <p style="font-size:15px;color:#5C5954;line-height:1.6;margin:0 0 16px">Your account is set up and ready to go.</p>
          <p style="font-size:14px;color:#5C5954;line-height:1.6;margin:0 0 8px"><strong>As a creator:</strong> List your AI bots for free and earn 85% of every sale.</p>
          <p style="font-size:14px;color:#5C5954;line-height:1.6;margin:0 0 24px"><strong>As a buyer:</strong> Browse and subscribe to AI bots for your business.</p>
          <a href="https://mosaicbots.com" style="display:inline-block;padding:10px 24px;background:#1A1816;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">Explore Mosaic</a>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E6E1"><p style="font-size:11px;color:#9C9890;margin:0">Mosaic — AI Bot Marketplace<br>mosaicbots.com</p></div>
        </div>`,
    },
  };

  const tmpl = templates[type];
  if (!tmpl) return res.status(400).json({ error: "Invalid notification type" });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Mosaic <noreply@mosaicbots.com>",
        to: [to],
        subject: tmpl.subject,
        html: tmpl.html,
      }),
    });
    const result = await response.json();
    if (!response.ok) return res.status(500).json({ error: result.message || "Failed to send" });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Notify error:", err);
    return res.status(500).json({ error: "Failed to send notification" });
  }
}
