import { json, corsPreflight, isAdmin, newId } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// GET /api/subscribers — admin only (used by the Reports tab for a count).
export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  const { results } = await env.DB.prepare("SELECT * FROM subscribers").all();
  return json(results);
}

// POST /api/subscribers — public. Captured optionally at checkout.
export async function onRequestPost({ request, env }) {
  const { contact } = await request.json();
  if (!contact) return json({ error: "Missing contact" }, 400);
  const existing = await env.DB.prepare("SELECT id FROM subscribers WHERE contact = ?").bind(contact).first();
  if (existing) return json({ id: existing.id, contact });
  const id = newId("s");
  await env.DB.prepare("INSERT INTO subscribers (id, contact) VALUES (?, ?)").bind(id, contact).run();
  return json({ id, contact }, 201);
}
