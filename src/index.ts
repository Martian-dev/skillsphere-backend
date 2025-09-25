import { Hono } from "hono";
import { Firestore } from "@google-cloud/firestore";
import { auth as adminAuth } from "./services/firebase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { type DecodedIdToken } from "firebase-admin/auth";
import { serve } from "bun";
import topicsRoutes from "./routes/topics";
import lessonsRoutes from "./routes/lessons";
import generateRoutes from "./routes/generateLessons";
import assessmentRoutes from "./routes/assessments";
import lessonContentRoutes from "./routes/lessonContent";
import userProfileRoutes from "./routes/userProfile";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono<{ Variables: { user: DecodedIdToken } }>();
app.use("*", logger());
app.use(cors());
// const firestore = new Firestore();
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

app.use("*", async (c, next) => {
  const auth = c.req.header("authorization");
  if (!auth) return c.json({ error: "unauthorized" }, 401);
  try {
    const token = auth.replace("Bearer ", "");
    const decoded = await adminAuth.verifyIdToken(token);
    c.set("user", decoded);
    await next();
  } catch {
    return c.json({ error: "invalid token" }, 401);
  }
});

app.route("/topics", topicsRoutes);
app.route("/lessons", lessonsRoutes);
app.route("/generate-lessons", generateRoutes);
app.route("/assessments", assessmentRoutes);
app.route("/lesson", lessonContentRoutes);
app.route("/user-profile", userProfileRoutes);

serve({
  fetch: app.fetch,
  port: process.env.PORT || 3000,
});
