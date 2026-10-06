import { json, corsPreflight, isAdmin } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// PUT /api/orders/:id — admin only. Updates order status
// (Pending / Processing / Shipped / Out for Delivery / Delivered).
export async function onRequestPut({ request, env, params }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  const { status } = await request.json();
  await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(status, params.id).run();
  return json({ id: params.id, status });
}

// DELETE /api/orders/:id — admin only.
export async function onRequestDelete({ request, env, params }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  await env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(params.id).run();
  return json({ deleted: params.id });
}
