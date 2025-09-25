import { Hono } from "hono";
import { db } from "../services/firebase";

const userProfileRoutes = new Hono();

// GET /user-profile/:userId
userProfileRoutes.get("/:userId", async (c) => {
  const userId = c.req.param("userId");
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
