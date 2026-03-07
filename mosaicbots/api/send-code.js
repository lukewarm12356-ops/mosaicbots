// POST /api/send-code
// Sends a 6-digit verification code via Resend
// Body: { "email": "user@example.com", "code": "123456" }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: "Missing email or code" });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: "API key not configured" });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Mosaic <noreply@mosaicbots.com>",
        to: [email],
        subject: `${code} is your Mosaic verification code`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#ffffff">
            <div style="margin-bottom:32px">
              <div style="display:inline-block">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:28px;height:28px;background:#1A1816;border-radius:7px;text-align:center;vertical-align:middle;color:#fff;font-weight:700;font-size:13px;font-family:monospace">M</td>
                  <td style="padding-left:8px;font-size:16px;font-weight:700;letter-spacing:-0.03em;font-family:-apple-system,sans-serif">Mosaic</td>
                </tr></table>
              </div>
            </div>
            <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#1A1816;font-family:-apple-system,sans-serif">Verify your email</h1>
            <p style="font-size:15px;color:#5C5954;line-height:1.6;margin:0 0 24px;font-family:-apple-system,sans-serif">Enter this code to complete your Mosaic account setup:</p>
            <div style="background:#F8F7F4;border:1px solid #E8E6E1;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
              <span style="font-size:36px;font-weight:700;letter-spacing:0.25em;color:#1A1816;font-family:'Courier New',monospace">${code}</span>
            </div>
            <p style="font-size:13px;color:#9C9890;line-height:1.6;margin:0 0 0;font-family:-apple-system,sans-serif">This code expires in 10 minutes. If you didn't create a Mosaic account, you can safely ignore this email.</p>
            <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E6E1">
              <p style="font-size:11px;color:#9C9890;margin:0;font-family:-apple-system,sans-serif">Mosaic &mdash; AI Bot Marketplace<br>mosaicbots.com</p>
            </div>
          </div>
        `,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", data);
      return res.status(500).json({ error: data.message || "Failed to send email" });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error("Send error:", err);
    return res.status(500).json({ error: "Failed to send email" });
  }
}
