// src/routes/generateLessons.ts
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

  const model = google("gemini-1.5-pro");
  const results: Record<string, any[]> = {};

  for (const topic of topics) {
    // Find or create the topicId
    const topicRef = await db
      .collection("topics")
      .where("name", "==", topic)
      .limit(1)
      .get();
    let topicId: string;
    if (topicRef.empty) {
      const doc = await db.collection("topics").add({ name: topic });
      topicId = doc.id;
    } else {
      topicId = topicRef.docs[0].id;
    }

    // UPDATED: The new, more efficient prompt
    const prompt = `You are an expert instructional designer. For the topic "${topic}", generate a JSON array of 5 unique, beginner-level lessons. Your response MUST be a single, raw JSON array. Do not include any text, comments, or markdown fences. Each object in the array must have this structure: { "title": "...", "xp": 100, "estimatedMinutes": 5, "difficulty": "beginner", "tags": [], "content": [], "assessment": { "passingScore": 80, "questions": [{ "id": "q1", "questionText": "...", "quizType": "multiple-choice", "tags": [], "options": [], "correctAnswerId": "...", "explanation": "..." }] } }`;

    try {
      // UPDATED: A single API call per topic
      const { text } = await generateText({ model, prompt, temperature: 0.4 });
      const clean = text.replace(/```json|```/g, "").trim();
      const lessons = JSON.parse(clean); // This is now an array of lessons

      const batch = db.batch();
      const generatedLessons = [];

      // UPDATED: Loop through the array of lessons returned by the AI
      for (const lesson of lessons) {
        const lessonRef = db.collection("lessons").doc(); // Create a new document reference
        batch.set(lessonRef, {
          ...lesson,
          topicId,
          createdAt: new Date(),
        });
        generatedLessons.push({ id: lessonRef.id, ...lesson });
      }

      await batch.commit(); // Commit all lessons to Firestore at once
      results[topic] = generatedLessons;
    } catch (error) {
      console.error(
        `Failed to generate lessons for topic "${topic}". Error:`,
        error
      );
      results[topic] = []; // Add an empty array for failed topics
    }
  }

  return c.json({ status: "ok", results });
});

export default generateRoutes;
