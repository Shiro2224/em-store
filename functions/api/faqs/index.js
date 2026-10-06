import { json, corsPreflight, isAdmin, newId } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT * FROM faqs").all();
  return json(results);
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  const { q, a } = await request.json();
  if (!q || !a) return json({ error: "Missing fields" }, 400);
  const id = newId("f");
  await env.DB.prepare("INSERT INTO faqs (id, q, a) VALUES (?, ?, ?)").bind(id, q, a).run();
  return json({ id, q, a }, 201);
}
