// Shared delivery-zone logic used by BOTH functions/api/delivery-zones/index.js
// (the admin-facing GET/PUT endpoint) and functions/api/orders/index.js (which
// needs to look up the real fee server-side when an order is placed).
//
// This lives in _helpers (files/folders starting with "_" are not treated as
// routes by Cloudflare Pages) specifically so it's shared code, not another
// route — importing straight from one route file into another route file is
// what was crashing every single API endpoint on this project.

// Delivery is local-only: Warri and Effurun. These are the starting fees —
// kept in the `settings` table (not hardcoded) so the business owner can
// change the naira amounts later from the admin panel without anyone
// touching code. The zone KEYS and LABELS are fixed on purpose (so the
// server always knows exactly which zones are valid); only the `fee` on
// each one is editable.
export const DEFAULT_ZONES = [
  { key: "pickup", label: "Customer Pickup", fee: 0, editable: false },
  { key: "nearby", label: "Nearby Warri", fee: 1500, editable: true },
  { key: "standard", label: "Standard Warri/Effurun", fee: 2000, editable: true },
  { key: "far", label: "Farther Areas Around Warri", fee: 3000, editable: true },
];

export const DELIVERY_SETTINGS_KEY = "delivery_zones";

// Reads the current zone list from the settings table, seeding it with the
// defaults above the first time it's ever read. This is also used
// server-side by functions/api/orders/index.js to look up the real fee for
// an order — the browser's number is never trusted.
export async function getDeliveryZones(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(DELIVERY_SETTINGS_KEY).first();
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
    .bind(DELIVERY_SETTINGS_KEY, JSON.stringify(DEFAULT_ZONES))
    .run();
  return DEFAULT_ZONES;
}
