import { json, corsPreflight } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// GET /api/track/:id — public. Anyone with the exact order ID can check
// status. Does not require the admin key, but only returns what a
// customer needs to see (no other customers' data is exposed).
export async function onRequestGet({ env, params }) {
  const order = await env.DB.prepare("SELECT * FROM orders WHERE UPPER(id) = UPPER(?)").bind(params.id).first();
  if (!order) return json({ error: "Order not found" }, 404);
  return json({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: order.total,
    address: order.address,
    originState: order.originState,
    destState: order.destState,
    country: order.country,
    items: JSON.parse(order.items),
  });
}
