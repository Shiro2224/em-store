import { json, corsPreflight, isAdmin } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// DELETE /api/orders/clear — admin only. Wipes every order (Reports reset).
export async function onRequestDelete({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  await env.DB.prepare("DELETE FROM orders").run();
  return json({ cleared: true });
}
