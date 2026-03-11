// GET /api/connect-status?accountId=acct_xxx
// Checks if a Stripe Connect account has completed onboarding

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return res.status(500).json({ error: "Stripe not configured" });

  const { accountId } = req.query || {};
  if (!accountId) return res.status(400).json({ error: "Missing accountId" });

  try {
    const acctRes = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
      headers: { "Authorization": `Bearer ${sk}` },
    });
    const acctData = await acctRes.json();
    if (!acctRes.ok) return res.status(500).json({ error: acctData.error?.message || "Failed to fetch account" });

    return res.status(200).json({
      accountId: acctData.id,
      chargesEnabled: acctData.charges_enabled,
      payoutsEnabled: acctData.payouts_enabled,
      detailsSubmitted: acctData.details_submitted,
      email: acctData.email,
    });
  } catch (err) {
    console.error("Connect status error:", err);
    return res.status(500).json({ error: "Failed to check account status" });
  }
}
