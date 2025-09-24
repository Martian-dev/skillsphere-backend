// src/routes/assessments.ts

import { Hono } from "hono";
import { db } from "../services/firebase";
import { Lesson, ContentSnippet, UserProgress } from "../types/models";
import { FieldValue } from "firebase-admin/firestore";
// ADD THESE IMPORTS for on-the-fly generation
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

type AssessmentContext = {
  Variables: {
    user: { uid: string };
  };
};

const assessmentRoutes = new Hono<AssessmentContext>();

assessmentRoutes.post("/:lessonId/submit", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { lessonId } = c.req.param();
    const { answers } = await c.req.json<{
      answers: { questionId: string; selectedOptionId: string }[];
    }>();

    if (!answers || !Array.isArray(answers)) {
      return c.json({ error: "Invalid submission format" }, 400);
    }

    const lessonRef = db.collection("lessons").doc(lessonId);
    const lessonDoc = await lessonRef.get();
    if (!lessonDoc.exists) {
      return c.json({ error: "Lesson not found" }, 404);
    }
    const lesson = lessonDoc.data() as Lesson;
    const { questions, passingScore } = lesson.assessment;

    // ... (Grading logic remains the same)
    let correctAnswers = 0;
    const weakTags = new Set<string>();
    const answerMap = new Map(questions.map((q) => [q.id, q]));
    answers.forEach((userAnswer) => {
      const question = answerMap.get(userAnswer.questionId);
      if (question) {
        if (question.correctAnswerId === userAnswer.selectedOptionId) {
          correctAnswers++;
        } else {
          question.tags.forEach((tag) => weakTags.add(tag));
        }
      }
    });
    const score = Math.round((correctAnswers / questions.length) * 100);

    // ... (Update User Progress logic remains the same)
    const progressRef = db
      .collection("userProgress")
      .doc(`${user.uid}_${lessonId}`);
    // ... (code to set progress)

    if (score >= passingScore) {
      // ... (Passing logic remains the same)
      const nextOrder = lesson.order + 1;
      const nextLessonSnapshot = await db
        .collection("lessons")
        .where("topicId", "==", lesson.topicId)
        .where("order", "==", nextOrder)
        .limit(1)
        .get();
      let nextLessonId: string | null = null;
      if (!nextLessonSnapshot.empty) {
        nextLessonId = nextLessonSnapshot.docs[0].id;
      }
      return c.json({
        status: "passed",
        score: score,
        xpEarned: lesson.xp,
        nextLessonId: nextLessonId,
      });
    } else {
      // --- NEW: AI-POWERED REMEDIAL LESSON GENERATION ---

      let remedialLesson = null;
      if (weakTags.size > 0) {
        const failedConcepts = Array.from(weakTags).join(", ");

        // 1. Create a focused prompt
        const prompt = `A user failed a quiz on these concepts: "${failedConcepts}". 
        Generate one short, simple, beginner-level lesson to help them understand.
        Respond ONLY with a raw JSON object matching this schema:
        {
          "title": "A helpful title about ${failedConcepts}",
          "estimatedMinutes": 3,
          "difficulty": "beginner",
          "content": [
            { "type": "info", "text": "A simple explanation of the first concept." },
            { "type": "scenario", "text": "A clear example of the concepts in practice." },
            { "type": "info", "text": "A summary or tip to remember the concepts." }
          ]
        }`;

        // 2. Call the AI model
        const model = google("gemini-1.5-flash"); // Flash is perfect for this fast, targeted task
        const { text } = await generateText({ model, prompt });
        remedialLesson = JSON.parse(text.replace(/```json|```/g, "").trim());
      }

      // 3. Return the newly generated lesson to the user
      return c.json({
        status: "requires_review",
        score: score,
        remedialLesson: remedialLesson, // The app will now receive a full lesson object
      });
      // --- END OF NEW LOGIC ---
    }
  } catch (error) {
    console.error("Error submitting assessment:", error);
    return c.json({ error: "An internal error occurred" }, 500);
  }
});

export default assessmentRoutes;
