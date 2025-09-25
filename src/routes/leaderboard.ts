// src/routes/leaderboard.ts

import { Hono } from "hono";
import { db } from "../services/firebase";
import { UserProfile } from "../types/models";

const leaderboardRoutes = new Hono();

// GET /leaderboard -> returns the top 20 users
leaderboardRoutes.get("/", async (c) => {
  try {
    const limit = 20;

    const usersSnapshot = await db
      .collection("userProfiles")
      .orderBy("totalXp", "desc")
      .limit(limit)
      .get();

    if (usersSnapshot.empty) {
      return c.json([]);
    }

    // Map the documents to a clean format with the user ID
    const leaderboard = usersSnapshot.docs.map((doc, index) => {
      const user = doc.data() as UserProfile;
      return {
        rank: index + 1,
        uid: user.userId, // <-- CHANGED: Return the uid
        xp: user.totalXp,
      };
    });

    return c.json(leaderboard);
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
    return c.json({ error: "Could not retrieve leaderboard data" }, 500);
  }
});

export default leaderboardRoutes;
