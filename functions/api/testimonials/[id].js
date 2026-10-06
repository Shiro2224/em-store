import { json, corsPreflight, isAdmin } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// PUT /api/testimonials/:id — admin only. Edit text/stars/name, or
// toggle approved on/off (publish/unpublish).
export async function onRequestPut({ request, env, params }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  const existing = await env.DB.prepare("SELECT * FROM testimonials WHERE id = ?").bind(params.id).first();
  if (!existing) return json({ error: "Not found" }, 404);
  const body = await request.json();
  const updated = {
    name: body.name ?? existing.name,
    text: body.text ?? existing.text,
    stars: body.stars ?? existing.stars,
    approved: body.approved !== undefined ? (body.approved ? 1 : 0) : existing.approved,
  };
  await env.DB.prepare("UPDATE testimonials SET name=?, text=?, stars=?, approved=? WHERE id=?")
    .bind(updated.name, updated.text, updated.stars, updated.approved, params.id)
    .run();
  return json({ id: params.id, ...updated });
}

export async function onRequestDelete({ request, env, params }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  await env.DB.prepare("DELETE FROM testimonials WHERE id = ?").bind(params.id).run();
  return json({ deleted: params.id });
}
