import { json, corsPreflight, isAdmin } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestDelete({ request, env, params }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  await env.DB.prepare("DELETE FROM promotions WHERE id = ?").bind(params.id).run();
  return json({ deleted: params.id });
}
