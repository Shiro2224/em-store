import { json, corsPreflight, isAdmin, newId } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// GET /api/products — public, returns every product (stock/price info is
// not sensitive, so no admin check needed here).
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT * FROM products").all();
  const products = results.map((p) => ({ ...p, images: JSON.parse(p.images || "[]") }));
  return json(products);
}

// POST /api/products — admin only. Creates a new product.
export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  const body = await request.json();
  const id = newId("p");
  const images = JSON.stringify(body.images || []);
  await env.DB.prepare(
    `INSERT INTO products (id, name, cat, price, discountPrice, stock, emoji, desc, images)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.name,
      body.cat,
      body.price,
      body.discountPrice || 0,
      body.stock || 0,
      body.emoji || "📦",
      body.desc || "",
      images
    )
    .run();
  return json({ id, ...body }, 201);
}
