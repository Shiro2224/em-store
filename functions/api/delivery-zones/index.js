import { json, corsPreflight, isAdmin } from "../../_helpers/utils.js";
import { getDeliveryZones, DELIVERY_SETTINGS_KEY } from "../../_helpers/deliveryZones.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// GET /api/delivery-zones — public. The checkout page calls this to know
// which delivery options to show and what each currently costs.
export async function onRequestGet({ env }) {
  const zones = await getDeliveryZones(env);
  return json(zones);
}

// PUT /api/delivery-zones — admin only. Body: { fees: { nearby: 1500, standard: 2000, far: 3000 } }
// Only updates the `fee` on existing editable zones — it cannot add,
// remove, or rename zones, and it cannot touch Customer Pickup's ₦0 fee.
// That keeps the server's idea of "a valid Warri/Effurun zone" fixed even
// though the prices are adjustable.
export async function onRequestPut({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  const body = await request.json();
  const fees = body && body.fees;
  if (!fees || typeof fees !== "object") return json({ error: "Missing fees object" }, 400);

  const zones = await getDeliveryZones(env);
  const updated = zones.map((z) => {
    if (!z.editable) return z; // pickup always stays ₦0
    if (Object.prototype.hasOwnProperty.call(fees, z.key)) {
      const n = Number(fees[z.key]);
      if (Number.isFinite(n) && n >= 0) return { ...z, fee: Math.round(n) };
    }
    return z;
  });

  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(DELIVERY_SETTINGS_KEY, JSON.stringify(updated))
    .run();

  return json(updated);
}
