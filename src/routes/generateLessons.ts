import { Hono } from "hono";
import { db } from "../services/firebase";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

const generateRoutes = new Hono();

generateRoutes.post("/", async (c) => {
  const { topics } = await c.req.json<{ topics: string[] }>();
  if (!topics || !Array.isArray(topics)) {
    return c.json({ error: "topics[] required" }, 400);
  }

  const model = google("gemini-2.5-pro");

  const results: Record<string, any[]> = {};

  for (const topic of topics) {
    const prompt = `Generate 5 beginner lesson outlines for the topic "${topic}".
Return JSON array where each element has:
id (slug), title, xp (int), estimatedMinutes (int), difficulty ("beginner"),
tags (string[]), and a content array of 3–5 microcards (scenario|info|decision|quiz)
with text <= 280 chars.`;

    const { text } = await generateText({ model, prompt, temperature: 0.3 });
    // Strip code fences before parsing
    const clean = text.replace(/```json|```/g, "").trim();
    const lessons = JSON.parse(clean);

    // Store each lesson under lessons collection with topicId reference
    const topicRef = await db
      .collection("topics")
      .where("name", "==", topic)
      .limit(1)
      .get();
    let topicId: string;
    if (topicRef.empty) {
      // create topic doc if missing
      const doc = await db.collection("topics").add({ name: topic });
      topicId = doc.id;
    } else {
      topicId = topicRef.docs[0].id;
    }

    for (const lesson of lessons) {
      await db.collection("lessons").add({
        ...lesson,
        topicId,
        createdAt: new Date(),
      });
    }

    results[topic] = lessons;
  }

  return c.json({ status: "ok", results });
});

export default generateRoutes;
