// POST /api/connect-account
// Creates a Stripe Connect Express account for a creator and returns onboarding URL
// Body: { email, userId, name }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return res.status(500).json({ error: "Stripe not configured" });

  const { email, userId, name, stripeAccountId } = req.body || {};

  try {
    const origin = req.headers.origin || req.headers.referer || "https://mosaicbots.com";
    const baseUrl = origin.replace(/\/$/, "");

    // If they already have a Stripe account, create a new onboarding link
    if (stripeAccountId) {
      const params = new URLSearchParams();
      params.append("account", stripeAccountId);
      params.append("refresh_url", `${baseUrl}?connect=refresh`);
      params.append("return_url", `${baseUrl}?connect=complete`);
      params.append("type", "account_onboarding");

      const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
        method: "POST",
        headers: { "Authorization": `Bearer ${sk}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const linkData = await linkRes.json();
      if (!linkRes.ok) return res.status(500).json({ error: linkData.error?.message || "Failed to create link" });
      return res.status(200).json({ url: linkData.url, accountId: stripeAccountId });
    }

    // Create new Connect Express account
    const acctParams = new URLSearchParams();
    acctParams.append("type", "express");
    if (email) acctParams.append("email", email);
    if (name) acctParams.append("business_profile[name]", name);
    acctParams.append("business_profile[product_description]", "AI bot creator on Mosaic marketplace");
    acctParams.append("capabilities[card_payments][requested]", "true");
    acctParams.append("capabilities[transfers][requested]", "true");
    acctParams.append("metadata[userId]", userId || "");
    acctParams.append("metadata[platform]", "mosaicbots");

    const acctRes = await fetch("https://api.stripe.com/v1/accounts", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sk}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: acctParams.toString(),
    });
    const acctData = await acctRes.json();
    if (!acctRes.ok) return res.status(500).json({ error: acctData.error?.message || "Failed to create account" });

    // Create onboarding link
    const linkParams = new URLSearchParams();
    linkParams.append("account", acctData.id);
    linkParams.append("refresh_url", `${baseUrl}?connect=refresh`);
    linkParams.append("return_url", `${baseUrl}?connect=complete`);
    linkParams.append("type", "account_onboarding");

    const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sk}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: linkParams.toString(),
    });
    const linkData = await linkRes.json();
    if (!linkRes.ok) return res.status(500).json({ error: linkData.error?.message || "Failed to create onboarding link" });

    return res.status(200).json({ url: linkData.url, accountId: acctData.id });
  } catch (err) {
    console.error("Connect error:", err);
    return res.status(500).json({ error: "Failed to create Connect account" });
  }
}
