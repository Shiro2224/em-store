// Shared helpers used by every API function.
// Files/folders starting with "_" are not treated as routes by Cloudflare Pages.

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    },
  });
}

export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    },
  });
}

// Checks the X-Admin-Key header against the ADMIN_KEY secret.
// Used to protect admin-only actions (adding/editing products, viewing all
// orders, managing promotions/FAQs/reviews, etc).
export function isAdmin(request, env) {
  const key = request.headers.get("X-Admin-Key");
  return key && env.ADMIN_KEY && key === env.ADMIN_KEY;
}

export function newId(prefix) {
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
}
