import { Hono } from "hono";
import { db } from "../services/firebase";

const lessonsRoutes = new Hono();

const MAPPINGS = {
  Finance: "qz86ZeGsFumWUaZg00TU",
  Politics: "EVPXG2Qn5OJmtD3fOYDb",
};

// GET /lessons/:topicId → all lessons in a topic
lessonsRoutes.get("/:topicId", async (c) => {
  const topicId = c.req.param("topicId");
  if (!topicId) return c.json({ error: "topicId required" }, 400);
  if (!Object.keys(MAPPINGS).includes(topicId))
    return c.json({ error: "invalid topicId" }, 400);

  const snap = await db
    .collection("lessons")
    .where("topicId", "==", MAPPINGS[topicId as keyof typeof MAPPINGS])
    // .orderBy("order")
    .get();

  const lessons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return c.json(lessons);
});

export default lessonsRoutes;
