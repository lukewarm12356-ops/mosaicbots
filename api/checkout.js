// POST /api/checkout
// Creates a Stripe Checkout session with automatic 85/15 split via Connect
// Body: { botId, botName, price, buyerEmail, creatorStripeAccount }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return res.status(500).json({ error: "Stripe not configured" });

  const { botId, botName, price, buyerEmail, creatorStripeAccount, pricingModel } = req.body || {};
  if (!botId || !botName || !price) return res.status(400).json({ error: "Missing required fields" });

  const isSubscription = pricingModel === "subscription";

  try {
    const origin = req.headers.origin || req.headers.referer || "https://mosaicbots.com";
    const baseUrl = origin.replace(/\/$/, "");
    const amountCents = Math.round(price * 100);
    const platformFeeCents = Math.round(amountCents * 0.15); // 15% to Mosaic

    const params = new URLSearchParams();
    params.append("payment_method_types[]", "card");
    params.append("mode", isSubscription ? "subscription" : "payment");
    if (buyerEmail) params.append("customer_email", buyerEmail);
    params.append("line_items[0][price_data][currency]", "usd");
    params.append("line_items[0][price_data][product_data][name]", botName);
    params.append("line_items[0][price_data][product_data][description]", isSubscription ? `Monthly subscription to ${botName} on Mosaic` : `One-time purchase of ${botName} on Mosaic`);
    params.append("line_items[0][price_data][unit_amount]", String(amountCents));
    if (isSubscription) params.append("line_items[0][price_data][recurring][interval]", "month");
    params.append("line_items[0][quantity]", "1");
    params.append("metadata[botId]", botId);
    params.append("metadata[botName]", botName);
    params.append("success_url", `${baseUrl}?purchased=${botId}`);
    params.append("cancel_url", baseUrl);

    // If creator has a connected Stripe account, use Connect for automatic split
    if (creatorStripeAccount) {
      params.append("subscription_data[application_fee_percent]", "15");
      // Use the Stripe-Account header for connected account
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sk}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Stripe-Account": creatorStripeAccount,
        },
        body: params.toString(),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("Stripe Connect error:", data);
        return res.status(500).json({ error: data.error?.message || "Stripe error" });
      }
      return res.status(200).json({ url: data.url, id: data.id });
    }

    // No connected account — payment goes directly to platform
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sk}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Stripe error:", data);
      return res.status(500).json({ error: data.error?.message || "Stripe error" });
    }
    return res.status(200).json({ url: data.url, id: data.id });
  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
}
