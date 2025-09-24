// src/routes/assessments.ts

import { Hono } from "hono";
import { db } from "../services/firebase";
import { Lesson, ContentSnippet, UserProgress } from "../types/models";
import { FieldValue } from "firebase-admin/firestore";

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

    // 1. Fetch Lesson Data
    const lessonRef = db.collection("lessons").doc(lessonId);
    const lessonDoc = await lessonRef.get();
    if (!lessonDoc.exists) {
      return c.json({ error: "Lesson not found" }, 404);
    }
    const lesson = lessonDoc.data() as Lesson;
    const { questions, passingScore } = lesson.assessment;

    // 2. Grade the Submission
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

    // 3. Update User Progress
    const progressRef = db
      .collection("userProgress")
      .doc(`${user.uid}_${lessonId}`);
    const newAttempt = {
      timestamp: FieldValue.serverTimestamp(),
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

    // 4. Respond Dynamically
    if (score >= passingScore) {
      // Logic to find the next lesson would go here
      return c.json({
        status: "passed",
        score: score,
        xpEarned: lesson.xp,
        nextLessonId: "placeholder_next_lesson_id", // TODO: Implement next lesson logic
      });
    } else {
      let remedialContent: ContentSnippet[] = [];
      if (weakTags.size > 0) {
        const snippetsSnapshot = await db
          .collection("contentSnippets")
          .where("tags", "array-contains-any", Array.from(weakTags))
          .get();
        remedialContent = snippetsSnapshot.docs.map(
          (doc) => doc.data() as ContentSnippet
        );
      }
      return c.json({
        status: "requires_review",
        score: score,
        remedialContent: remedialContent.map((s) => s.content),
      });
    }
  } catch (error) {
    console.error("Error submitting assessment:", error);
    return c.json({ error: "An internal error occurred" }, 500);
  }
});

export default assessmentRoutes;
