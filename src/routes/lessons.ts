// src/routes/lessons.ts

import { Hono } from "hono";
import { db } from "../services/firebase";

const lessonsRoutes = new Hono();

// GET /lessons/:topicId → all lessons in a topic
lessonsRoutes.get("/:topicId", async (c) => {
  const { topicId } = c.req.param();

  if (!topicId) {
    return c.json({ error: "A valid topicId is required" }, 400);
  }

  try {
    const lessonsSnapshot = await db
      .collection("lessons")
      .where("topicId", "==", topicId)
      // .orderBy("createdAt") // Consider ordering lessons by creation time or an 'order' field
      .get();

    if (lessonsSnapshot.empty) {
      // It's good practice to handle cases where no lessons are found
      return c.json([]);
    }

    const lessons = lessonsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return c.json(lessons);
  } catch (error) {
    console.error(`Failed to fetch lessons for topic ${topicId}:`, error);
    return c.json(
      { error: "Failed to retrieve lessons from the database" },
      500
    );
  }
});

export default lessonsRoutes;
