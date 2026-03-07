// POST /api/bots/studybuddy
// StudyBuddy - full study tool API
// Supports: chat, study guide generation, flashcard creation, quiz mode

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, mode, content, session_id, image, imageType } = req.body || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const systemPrompts = {
    chat: `You are StudyBuddy, a world-class AI tutor. Be warm, encouraging, and patient. Help students understand concepts deeply — never just give answers. Use analogies, examples, and step-by-step breakdowns. If they're stuck, break problems into smaller pieces. Celebrate their progress. Keep responses clear and focused.`,

    studyguide: `You are StudyBuddy generating a comprehensive study guide. Analyze the provided material and create a well-organized study guide with:
- Key concepts and definitions (use bold for terms)
- Important relationships between ideas
- Common exam questions on this material
- Memory tips and mnemonics
- A summary section at the end
Format it cleanly with clear headers and bullet points. Make it genuinely useful for exam prep.`,

    flashcards: `You are StudyBuddy creating flashcards. Analyze the provided material and generate 10-15 flashcards. Return ONLY valid JSON in this exact format, no other text:
[{"front":"question or term","back":"answer or definition"},{"front":"...","back":"..."}]
Make cards that test real understanding, not just memorization. Include a mix of definitions, concept applications, and connections between ideas.`,

    quiz: `You are StudyBuddy running a quiz. Based on the material provided, ask ONE question at a time. After they answer, tell them if they're right or wrong with a brief explanation, then ask the next question. Keep score mentally. Be encouraging even when they get things wrong. Mix question types: multiple choice, short answer, and true/false. Start with an easier question and build up.`,

    explain: `You are StudyBuddy explaining a concept. Take the highlighted text or concept and explain it in the simplest possible terms. Use an analogy from everyday life. Then give a concrete example. Then explain why it matters in the bigger picture. Keep it conversational and clear.`,
  };

  const activeMode = mode || "chat";
  const systemPrompt = systemPrompts[activeMode] || systemPrompts.chat;

  let userMessage = message || "";
  if (content && (activeMode === "studyguide" || activeMode === "flashcards" || activeMode === "quiz")) {
    userMessage = `Here is the study material:\n\n${content}\n\n${message || (activeMode === "studyguide" ? "Generate a study guide from this material." : activeMode === "flashcards" ? "Generate flashcards from this material." : "Start quizzing me on this material.")}`;
  }

  if (!userMessage && !image) return res.status(400).json({ error: "Message required" });

  // Build the messages array - support text and images
  let userContent;
  if (image) {
    userContent = [
      { type: "image", source: { type: "base64", media_type: imageType || "image/jpeg", data: image } },
      { type: "text", text: userMessage || "Describe this image and extract any study material from it." }
    ];
  } else {
    userContent = userMessage;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    const data = await response.json();
    const reply = data.content?.[0]?.text || "Sorry, I had trouble with that. Try again.";
    return res.status(200).json({ response: reply, session_id: session_id || "", mode: activeMode });
  } catch (e) {
    console.error("StudyBuddy error:", e);
    return res.status(500).json({ error: "Failed to get response" });
  }
}
