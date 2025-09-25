import { Hono } from "hono";
import { db } from "../services/firebase";

const lessonContentRoutes = new Hono();

lessonContentRoutes.get("/:lessonId", async (c) => {
  const lessonId = c.req.param("lessonId");
  if (!lessonId) {
    return c.json({ error: "Missing lessonId parameter" }, 400);
  }

  try {
    const lessonDoc = await db.collection("lessons").doc(lessonId).get();
    if (!lessonDoc.exists) {
      return c.json({ error: "Lesson not found" }, 404);
    }
    const lesson = lessonDoc.data();
    // Remove explanation and correctAnswerId from each assessment question if present
    if (lesson?.assessment?.questions) {
      lesson.assessment.questions = lesson.assessment.questions.map(
        (q: any) => {
          const { explanation, correctAnswerId, ...rest } = q;
          return rest;
        }
      );
    }
    return c.json({ lessonId, ...lesson });
  } catch (error) {
    return c.json(
      { error: "Failed to fetch lesson", details: String(error) },
      500
    );
  }
});

export default lessonContentRoutes;
