import { Hono } from "hono";
import { db } from "../services/firebase";

const topicsRoutes = new Hono();

// GET /topics → list all topics
topicsRoutes.get("/", async (c) => {
  const snap = await db.collection("topics").get();
  const topics = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return c.json(topics);
});

// POST /topics → create new topic (if you want admin creation)
topicsRoutes.post("/", async (c) => {
  const data = await c.req.json();
  const doc = await db.collection("topics").add(data);
  return c.json({ id: doc.id });
});

export default topicsRoutes;
