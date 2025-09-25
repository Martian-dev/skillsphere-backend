import { Hono } from "hono";
import type { DecodedIdToken } from "firebase-admin/auth";
import { db } from "../services/firebase";

const userProfileRoutes = new Hono<{ Variables: { user: DecodedIdToken } }>();

// GET /user-profile/:userId
userProfileRoutes.get("/", async (c) => {
  const user = c.get("user");
  const userId = user?.uid;
  if (!userId) {
    return c.json({ error: "Missing userId parameter" }, 400);
  }
  try {
    const docRef = db.collection("userProfiles").doc(userId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return c.json({ error: "User profile not found" }, 404);
    }
    return c.json(doc.data());
  } catch (error) {
    return c.json(
      { error: "Failed to fetch user profile", details: String(error) },
      500
    );
  }
});

export default userProfileRoutes;
