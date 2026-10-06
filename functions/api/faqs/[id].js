import { json, corsPreflight, isAdmin } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestPut({ request, env, params }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  const { q, a } = await request.json();
  await env.DB.prepare("UPDATE faqs SET q = ?, a = ? WHERE id = ?").bind(q, a, params.id).run();
  return json({ id: params.id, q, a });
}

export async function onRequestDelete({ request, env, params }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  await env.DB.prepare("DELETE FROM faqs WHERE id = ?").bind(params.id).run();
  return json({ deleted: params.id });
}
