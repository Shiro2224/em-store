import { json, corsPreflight, isAdmin } from "../../_helpers/utils.js";
import { getDeliveryZones } from "../../_helpers/deliveryZones.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// GET /api/orders — admin only. Full order list with customer details.
export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  const { results } = await env.DB.prepare("SELECT * FROM orders ORDER BY date DESC").all();
  const orders = results.map((o) => ({ ...o, items: JSON.parse(o.items) }));
  return json(orders);
}

// POST /api/orders — public (this is checkout, step 1 of 2).
//
// IMPORTANT — payment flow: this endpoint only CREATES the order record
// (paymentStatus = 'pending') and confirms stock is currently available.
// It deliberately does NOT deduct stock and does NOT mark the order
// fulfillable yet — that only happens once Flutterwave has verified a real
// payment (see functions/api/payments/verify.js and .../webhook.js, and
// functions/_helpers/payment.js for exactly where stock is deducted).
//
// This means an order existing in the database is not the same as an order
// being paid for — the frontend must call POST /api/payments/initialize
// right after this to actually send the customer to pay.
//
// DELIVERY FEE — SECURITY NOTE: the browser sends which delivery zone the
// customer picked (a short key like "nearby"), never a naira amount. The
// actual fee charged is always looked up here, server-side, from the
// `settings` table (see functions/api/delivery-zones/index.js). A customer
// editing values in their browser cannot change what they're charged.
export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { name, phone, deliveryMethod, deliveryZone, address, landmark, instructions, items } = body;

  if (!name || !phone || !items || !items.length) {
    return json({ error: "Missing required order fields" }, 400);
  }

  const method = deliveryMethod === "pickup" ? "pickup" : "delivery";

  // Look up the real, current delivery zones/fees — this is the ONLY source
  // of truth for price. Whatever the browser sent for a fee is ignored.
  const zones = await getDeliveryZones(env);
  let zoneKey, deliveryFee, zoneLabel;

  if (method === "pickup") {
    const pickupZone = zones.find((z) => z.key === "pickup");
    zoneKey = "pickup";
    zoneLabel = pickupZone ? pickupZone.label : "Customer Pickup";
    deliveryFee = 0; // pickup is always free, never trust/allow anything else
  } else {
    const match = zones.find((z) => z.key === deliveryZone && z.key !== "pickup");
    if (!match) {
      return json(
        { error: "Please choose a valid delivery area (Nearby Warri, Standard Warri/Effurun, or Farther Areas Around Warri)." },
        400
      );
    }
    if (!address || !address.trim()) return json({ error: "Please enter your full delivery address." }, 400);
    if (!landmark || !landmark.trim()) return json({ error: "Please enter a nearby landmark." }, 400);
    zoneKey = match.key;
    zoneLabel = match.label;
    deliveryFee = match.fee;
  }

  // Verify stock availability and compute the subtotal server-side (never
  // trust a client-sent total). Stock is checked here but NOT deducted yet.
  let subtotal = 0;
  for (const item of items) {
    const p = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(item.id).first();
    if (!p) return json({ error: `Product ${item.id} not found` }, 400);
    if (p.stock < item.qty) return json({ error: `${p.name} does not have enough stock` }, 400);
    const effectivePrice = p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price ? p.discountPrice : p.price;
    subtotal += effectivePrice * item.qty;
  }

  const total = subtotal + deliveryFee;
  const orderId = "EM-" + Math.floor(1000 + Math.random() * 9000);
  const date = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO orders (id, name, phone, address, deliveryMethod, deliveryZone, deliveryZoneLabel, deliveryFee, landmark, instructions, items, total, status, date, paymentStatus, paymentRef)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, 'pending', ?)`
  )
    .bind(
      orderId,
      name,
      phone,
      method === "pickup" ? "" : address.trim(),
      method,
      zoneKey,
      zoneLabel,
      deliveryFee,
      method === "pickup" ? "" : landmark.trim(),
      (instructions || "").trim(),
      JSON.stringify(items),
      total,
      date,
      orderId
    )
    .run();

  // No stock deduction here — see the note above. The frontend proceeds to
  // call /api/payments/initialize with this order id next.
  return json({ id: orderId, total, deliveryFee, status: "Pending", paymentStatus: "pending", date }, 201);
}
