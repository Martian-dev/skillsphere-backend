// src/routes/assessments.ts

import { Hono } from "hono";
import { db } from "../services/firebase";
import {
  Lesson,
  ContentSnippet,
  UserProgress,
  UserProfile,
} from "../types/models";
import { FieldValue } from "firebase-admin/firestore";
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

    // Grading logic to determine the score
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

    // Update the user's progress for this specific lesson attempt
    const progressRef = db
      .collection("userProgress")
      .doc(`${user.uid}_${lessonId}`);
    const newAttempt = {
      timestamp: new Date(),
      score,
      answers,
    };
    await progressRef.set(
      {
        userId: user.uid,
        lessonId: lessonId,
        score: score,
        status: score >= passingScore ? "completed" : "requires_review",
        quizAttempts: FieldValue.arrayUnion(newAttempt),
      },
      { merge: true }
    );

    if (score >= passingScore) {
      let xpAwarded = 0;
      const userProfileRef = db.collection("userProfiles").doc(user.uid);

      // Use a single transaction to safely update profile, XP, and streak
      await db.runTransaction(async (transaction) => {
        const profileDoc = await transaction.get(userProfileRef);
        const profile = profileDoc.exists
          ? (profileDoc.data() as UserProfile)
          : null;

        // --- 1. STREAK LOGIC ---
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0]; // Format: YYYY-MM-DD
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        let newStreak = 1; // Default for a new or reset streak
        const lastActivity = profile?.lastActivityDate;

        if (lastActivity) {
          if (lastActivity === yesterdayStr) {
            // Streak continues
            newStreak = (profile.currentStreak || 0) + 1;
          } else if (lastActivity === todayStr) {
            // Already active today, streak doesn't change
            newStreak = profile.currentStreak || 1;
          }
          // If last activity was before yesterday, streak resets to 1
        }

        // --- 2. XP LOGIC ---
        const isFirstCompletion =
          !profile?.completedLessons?.includes(lessonId);
        if (isFirstCompletion) {
          xpAwarded = lesson.xp;
        }

        // --- 3. DATABASE UPDATE ---
        if (!profile) {
          // Create a new profile if one doesn't exist
          transaction.set(userProfileRef, {
            userId: user.uid,
            totalXp: xpAwarded,
            completedLessons: isFirstCompletion ? [lessonId] : [],
            currentStreak: newStreak,
            lastActivityDate: todayStr,
          });
        } else {
          // Update the existing profile
          const updateData: { [key: string]: any } = {
            totalXp: FieldValue.increment(xpAwarded),
            currentStreak: newStreak,
            lastActivityDate: todayStr,
          };
          if (isFirstCompletion) {
            updateData.completedLessons = FieldValue.arrayUnion(lessonId);
          }
          transaction.update(userProfileRef, updateData);
        }
      });

      // Find the next lesson in the sequence
      const nextOrder = lesson.order + 1;
      const nextLessonSnapshot = await db
        .collection("lessons")
        .where("topicId", "==", lesson.topicId)
        .where("order", "==", nextOrder)
        .limit(1)
        .get();
      const nextLessonId = nextLessonSnapshot.empty
        ? null
        : nextLessonSnapshot.docs[0].id;

      return c.json({
        status: "passed",
        score: score,
        xpEarned: xpAwarded,
        nextLessonId: nextLessonId,
      });
    } else {
      // Logic to generate a remedial lesson if the user fails
      let remedialLesson = null;
      if (weakTags.size > 0) {
        const failedConcepts = Array.from(weakTags).join(", ");
        const prompt = `A user failed a quiz on these concepts: "${failedConcepts}". Generate one short, simple, beginner-level lesson to help them understand. Respond ONLY with a raw JSON object matching this schema: { "title": "A helpful title about ${failedConcepts}", "estimatedMinutes": 3, "difficulty": "beginner", "content": [ { "type": "info", "text": "A simple explanation of the first concept." }, { "type": "scenario", "text": "A clear example of the concepts in practice." }, { "type": "info", "text": "A summary or tip to remember the concepts." } ] }`;
        const model = google("gemini-1.5-flash");
        const { text } = await generateText({ model, prompt });
        remedialLesson = JSON.parse(text.replace(/```json|```/g, "").trim());
      }

      return c.json({
        status: "requires_review",
        score: score,
        remedialLesson: remedialLesson,
      });
    }
  } catch (error) {
    console.error("Error submitting assessment:", error);
    return c.json({ error: "An internal error occurred" }, 500);
  }
});

export default assessmentRoutes;
