import { json, corsPreflight } from "../../_helpers/utils.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// POST /api/payments/initialize — public. Body: { orderId }.
//
// Looks up an order that was already created via POST /api/orders, and asks
// Flutterwave to generate a hosted payment page for it. The SECRET key is
// used here, server-side only — it never reaches the browser. Returns the
// payment "link" for the frontend to redirect the customer to.
//
// Also works to let a customer RETRY payment on an order that's still
// 'pending' (e.g. they closed the Flutterwave tab without paying) — calling
// this again for the same orderId just generates a fresh payment link.
export async function onRequestPost({ request, env }) {
  const { orderId } = await request.json();
  if (!orderId) return json({ error: "Missing orderId" }, 400);

  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first();
  if (!order) return json({ error: "Order not found" }, 404);
  if (order.paymentStatus === "paid") {
    return json({ error: "This order has already been paid for." }, 400);
  }

  if (!env.FLW_SECRET_KEY) {
    // Flutterwave isn't configured yet. This is expected until real
    // credentials are added (see README) — fail clearly rather than
    // pretending a payment link was created.
    return json(
      {
        error:
          "Payments aren't turned on yet — the store's Flutterwave account isn't connected. (FLW_SECRET_KEY is not set.)",
      },
      503
    );
  }

  const siteUrl = env.SITE_URL || new URL(request.url).origin;

  const flwRes = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: order.id,
      amount: order.total,
      currency: "NGN",
      redirect_url: `${siteUrl}/?payment_return=1`,
      customer: {
        name: order.name,
        phonenumber: order.phone,
      },
      customizations: {
        title: "E.M. Business Enterprise",
        description: `Order ${order.id}`,
      },
    }),
  });

  const flwData = await flwRes.json();

  if (!flwRes.ok || flwData.status !== "success" || !flwData.data || !flwData.data.link) {
    return json(
      { error: "Could not start payment with Flutterwave. Please try again shortly." },
      502
    );
  }

  return json({ link: flwData.data.link });
}
