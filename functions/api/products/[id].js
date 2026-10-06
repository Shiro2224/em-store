import { json, corsPreflight, isAdmin } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// PUT /api/products/:id — admin only. Partial update: send only the fields
// that changed (e.g. { stock: 5 } or { discountPrice: 12000 } or
// { images: [...] }). Fields not sent are left untouched.
export async function onRequestPut({ request, env, params }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  const id = params.id;
  const body = await request.json();

  const existing = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Product not found" }, 404);

  const updated = {
    name: body.name ?? existing.name,
    cat: body.cat ?? existing.cat,
    price: body.price ?? existing.price,
    discountPrice: body.discountPrice ?? existing.discountPrice,
    stock: body.stock ?? existing.stock,
    emoji: body.emoji ?? existing.emoji,
    desc: body.desc ?? existing.desc,
    images: body.images ? JSON.stringify(body.images) : existing.images,
  };

  await env.DB.prepare(
    `UPDATE products SET name=?, cat=?, price=?, discountPrice=?, stock=?, emoji=?, desc=?, images=? WHERE id=?`
  )
    .bind(
      updated.name,
      updated.cat,
      updated.price,
      updated.discountPrice,
      updated.stock,
      updated.emoji,
      updated.desc,
      updated.images,
      id
    )
    .run();

  return json({ id, ...updated, images: JSON.parse(updated.images) });
}

// DELETE /api/products/:id — admin only.
export async function onRequestDelete({ request, env, params }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(params.id).run();
  return json({ deleted: params.id });
}
