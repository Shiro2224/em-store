import { json, corsPreflight, isAdmin, newId } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// GET /api/promotions — public. The frontend uses this to check whether
// today matches any promotion date and shows the sale banner if so.
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT * FROM promotions").all();
  return json(results);
}

// POST /api/promotions — admin only. Creates a new Discount Day.
export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  const { title, discount, date } = await request.json();
  if (!title || !discount || !date) return json({ error: "Missing fields" }, 400);
  const id = newId("pr");
  await env.DB.prepare("INSERT INTO promotions (id, title, discount, date) VALUES (?, ?, ?, ?)")
    .bind(id, title, discount, date)
    .run();
  return json({ id, title, discount, date }, 201);
}
