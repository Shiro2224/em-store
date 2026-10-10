-- Adds the local Warri/Effurun delivery system.
-- Run this once against your live D1 database (Cloudflare dashboard ->
-- Workers & Pages -> D1 -> your database -> Console tab -> paste and run),
-- or with: wrangler d1 execute <DB_NAME> --remote --file=migrations/0003_delivery_zones.sql
--
-- Safe to run on your existing database: it only ADDS new columns/tables,
-- it does not touch or delete any existing orders, products, or anything else.

ALTER TABLE orders ADD COLUMN deliveryMethod TEXT DEFAULT 'delivery';
ALTER TABLE orders ADD COLUMN deliveryZone TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN deliveryZoneLabel TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN deliveryFee INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN landmark TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN instructions TEXT DEFAULT '';

-- Backfill old orders (placed before this update) so the admin panel shows
-- something sensible for them instead of blanks. They keep whatever they
-- were actually charged in `total` — this only labels them.
UPDATE orders SET deliveryMethod = 'delivery' WHERE deliveryMethod IS NULL OR deliveryMethod = '';
UPDATE orders SET deliveryZoneLabel = 'Delivery (pre-update order)' WHERE deliveryZoneLabel = '' AND deliveryMethod = 'delivery';

-- New table used to store the editable delivery fees (and any future simple
-- site settings) as key/value JSON. The app seeds this automatically with
-- the default Warri/Effurun zones the first time /api/delivery-zones is
-- called, so you don't need to insert anything here yourself.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
