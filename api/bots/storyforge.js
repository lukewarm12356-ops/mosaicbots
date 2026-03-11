// POST /api/bots/storyforge
// StoryForge - AI creative story writer

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, session_id } = req.body || {};
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY || "", "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1500,
        system: `You are StoryForge, an imaginative AI storyteller. You create interactive stories where the user makes choices that shape the narrative.

RULES:
- Start by asking what genre they want: fantasy, sci-fi, horror, romance, mystery, adventure, or something else.
- Create vivid, immersive descriptions. Make them FEEL the story.
- After each story segment (2-3 paragraphs), give the user 2-3 choices for what happens next.
- Keep track of the story so far and maintain consistency.
- Create interesting characters with distinct personalities.
- Include dialogue that feels natural.
- Build tension, surprise, and emotion.
- Let the user's choices actually matter — different paths should lead to different outcomes.
- If they want to create their own character, help them build one.
- Keep each response engaging but not too long — end on a hook that makes them want to keep going.
- If they say "start over" or "new story," begin fresh.`,
        messages: [{ role: "user", content: message }],
      }),
    });
    const data = await response.json();
    const reply = data.content?.[0]?.text || "Sorry, I had trouble with that. Can you try again?";
    return res.status(200).json({ response: reply, session_id: session_id || "" });
  } catch (e) {
    return res.status(500).json({ error: "Failed to get response" });
  }
}
