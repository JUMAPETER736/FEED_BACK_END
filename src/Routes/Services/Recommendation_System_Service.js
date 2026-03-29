/**
 * recsys.service.js
 *
 * Central Axios client for the Python recommendation service.
 * All communication with http://localhost:8787 goes through here.
 *
 * Set RECSYS_URL in your .env (default: http://localhost:8787)
 */

import axios from "axios";

const client = axios.create({
  baseURL: process.env.RECSYS_URL,
  timeout: 8000,
  headers: { "Content-Type": "application/json" },
});

// ── Recommendations ───────────────────────────────────────────────

export const getFeedRecommendations = async (userId, limit = 20, page = 1) => {
  const { data } = await client.get(`/recommend/feed/${userId}`, {
    params: { limit, page },
  });
  // Handle both response shapes:
  //   { items: [...], end_of_feed: bool }  — standard
  //   [...]                                 — plain list (some paths return this)
  if (Array.isArray(data)) {
    return { items: data, end_of_feed: false };
  }
  return data;
};

export const getShotsRecommendations = async (userId, limit = 20, page = 1, sessionId = null) => {
  const params = { limit, page };
  if (sessionId) params.session_id = sessionId;
  const { data } = await client.get(`/recommend/shots/${userId}`, { params });
  if (Array.isArray(data)) {
    return { items: data, end_of_feed: false };
  }
  return data;
};

export const getMarketplaceRecommendations = async (userId, limit = 20, page = 1) => {
  const { data } = await client.get(`/recommend/marketplace/${userId}`, {
    params: { limit, page },
  });
  if (Array.isArray(data)) {
    return { items: data, end_of_feed: false };
  }
  return data;
};

export const getFriendSuggestions = async (userId, limit = 20) => {
  const { data } = await client.get(`/recommend/friends/${userId}`, {
    params: { limit },
  });
  return data.items || [];
};

// ── Embedding ─────────────────────────────────────────────────────

/**
 * Call after creating a feed post.
 * contentType: "image" | "video" | "mixed_files" | "text"
 */
export const embedPost = async (postId, content = "", contentType = "", tags = []) => {
  try {
    await client.post("/embed/post", { postId, content, contentType, tags });
  } catch (err) {
    console.error(`[RECSYS] embedPost failed for ${postId}:`, err.message);
  }
};

/** Call after creating a shot. */
export const embedShot = async (shotId, content = "") => {
  try {
    await client.post("/embed/shot", { shotId, content });
  } catch (err) {
    console.error(`[RECSYS] embedShot failed for ${shotId}:`, err.message);
  }
};

/** Call after creating or updating a product. */
export const embedProduct = async (productId, title = "", description = "", category = "", tags = []) => {
  try {
    await client.post("/embed/product", { productId, title, description, category, tags });
  } catch (err) {
    console.error(`[RECSYS] embedProduct failed for ${productId}:`, err.message);
  }
};

/** Call after user registration or profile update. */
export const embedUser = async (userId, displayName = "", bio = "", location = "") => {
  try {
    await client.post("/embed/user", { userId, displayName, bio, location });
  } catch (err) {
    console.error(`[RECSYS] embedUser failed for ${userId}:`, err.message);
  }
};

// ── Events ────────────────────────────────────────────────────────

/**
 * Log a user interaction event to PostgreSQL via Python service.
 * Always fire-and-forget — never awaited in request handlers.
 *
 * eventType:  "view" | "like" | "comment" | "share" | "replay" | "purchase_intent"
 * itemType:   "post" | "shot" | "product" | "user"
 */
export const logEvent = async (event) => {
  try {
    await client.post("/events/log", event);
  } catch (err) {
    // Non-critical — never block the main request for event logging
    console.error("[RECSYS] logEvent failed:", err.message);
  }
};

export const checkRecHealth = async () => {
  const { data } = await client.get("/health");
  return data;
};

/**
 * Call after every user_event insert.
 * Increments the event counter in PostgreSQL via Python.
 * Python fires a background retrain when threshold is reached.
 * Always fire-and-forget — never await this in a user-facing request.
 */
export const triggerModelRetrain = async () => {
  try {
    await client.post("/train/trigger");
  } catch (err) {
    // Non-critical — never block the main request
    console.error("[RECSYS] triggerModelRetrain failed:", err.message);
  }
};