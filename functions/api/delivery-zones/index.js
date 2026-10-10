import { json, corsPreflight, isAdmin } from "../../_helpers/utils.js";

// Delivery is local-only: Warri and Effurun. These are the starting fees —
// kept in the `settings` table (not hardcoded here) so the business owner
// can change the naira amounts later from the admin panel without anyone
// touching code. The zone KEYS and LABELS are fixed on purpose (so the
// server always knows exactly which zones are valid); only the `fee` on
// each one is editable.
const DEFAULT_ZONES = [
  { key: "pickup", label: "Customer Pickup", fee: 0, editable: false },
  { key: "nearby", label: "Nearby Warri", fee: 1500, editable: true },
  { key: "standard", label: "Standard Warri/Effurun", fee: 2000, editable: true },
  { key: "far", label: "Farther Areas Around Warri", fee: 3000, editable: true },
];

const SETTINGS_KEY = "delivery_zones";

// Reads the current zone list from the settings table, seeding it with the
// defaults above the first time it's ever read. This is also used
// server-side by functions/api/orders/index.js to look up the real fee for
// an order — the browser's number is never trusted.
export async function getDeliveryZones(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(SETTINGS_KEY).first();
  if (row && row.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (e) {
      // fall through to reseed with defaults if the stored value is corrupt
    }
  }
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(SETTINGS_KEY, JSON.stringify(DEFAULT_ZONES))
    .run();
  return DEFAULT_ZONES;
}

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
    .bind(SETTINGS_KEY, JSON.stringify(updated))
    .run();

  return json(updated);
}
