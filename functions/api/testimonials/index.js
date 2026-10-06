import { json, corsPreflight, isAdmin, newId } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// GET /api/testimonials — public gets only approved reviews.
// Admin (sends X-Admin-Key) gets everything, including pending ones.
export async function onRequestGet({ request, env }) {
  const admin = isAdmin(request, env);
  const query = admin
    ? "SELECT * FROM testimonials"
    : "SELECT * FROM testimonials WHERE approved = 1";
  const { results } = await env.DB.prepare(query).all();
  return json(results);
}

// POST /api/testimonials — public. Customers submit reviews from the
// order-tracking page. Always saved as pending (approved = 0) until an
// admin approves it — this is NOT an admin-only route on purpose.
export async function onRequestPost({ request, env }) {
  const { name, text, stars, orderId, approved } = await request.json();
  if (!name || !text || !stars) return json({ error: "Missing fields" }, 400);
  const id = newId("t");
  // A customer submission always starts unapproved, regardless of what's
  // sent, unless the request is authenticated as admin (used for the
  // "add testimonial manually" admin feature, which publishes instantly).
  const isApproved = isAdmin(request, env) ? (approved ? 1 : 0) : 0;
  await env.DB.prepare(
    "INSERT INTO testimonials (id, name, text, stars, orderId, approved) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, name, text, stars, orderId || "", isApproved)
    .run();
  return json({ id, name, text, stars, orderId: orderId || "", approved: isApproved }, 201);
}
