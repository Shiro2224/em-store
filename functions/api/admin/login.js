import { json, corsPreflight } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// POST /api/admin/login — checks the password typed into the admin login
// popup. On success, returns the ADMIN_KEY, which the frontend then stores
// and sends as the X-Admin-Key header on every admin request from then on.
//
// Note: this is intentionally simple (one shared password for both admins,
// matching what was asked for). For stronger security later, this is the
// file to extend with per-user accounts.
export async function onRequestPost({ request, env }) {
  const { password } = await request.json();
  // The admin LOGIN password can be different from the raw ADMIN_KEY used
  // internally, but for simplicity here they're the same value — whatever
  // you set ADMIN_KEY to in wrangler.toml (or the Pages dashboard) is the
  // password typed into the admin popup.
  if (password && env.ADMIN_KEY && password === env.ADMIN_KEY) {
    return json({ success: true, key: env.ADMIN_KEY });
  }
  return json({ success: false }, 401);
}
