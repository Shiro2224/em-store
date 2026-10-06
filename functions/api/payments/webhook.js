import { json, corsPreflight } from "../../_helpers/utils.js";
import { verifyFlutterwaveTransaction, confirmAndFulfillOrder } from "../../_helpers/payment.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// POST /api/payments/webhook — called by Flutterwave's servers directly
// (not by the customer's browser), whenever a payment event happens. This
// is the RELIABLE path: it still confirms an order even if the customer
// closes their browser tab right after paying, before the redirect-back
// page (verify.js) gets a chance to run.
//
// Configure this URL in the Flutterwave dashboard under
// Settings > Webhooks, as: https://ementerprise.store/api/payments/webhook
//
// Security: Flutterwave signs webhook requests with a "secret hash" you set
// in their dashboard, sent back in the `verif-hash` header. We check that
// BEFORE trusting anything in the request body — without this check,
// anyone could POST a fake "payment successful" request to this URL.
export async function onRequestPost({ request, env }) {
  if (!env.FLW_WEBHOOK_SECRET_HASH) {
    // Webhook secret not configured yet (expected until Flutterwave
    // credentials are added) — refuse rather than silently trusting
    // unverified requests.
    return json({ error: "Webhook not configured yet." }, 503);
  }

  const signature = request.headers.get("verif-hash");
  if (!signature || signature !== env.FLW_WEBHOOK_SECRET_HASH) {
    return json({ error: "Invalid webhook signature" }, 401);
  }

  const payload = await request.json();
  const txRef = payload && payload.data && payload.data.tx_ref;
  const transactionId = payload && payload.data && payload.data.id;

  if (!txRef || !transactionId) {
    return json({ error: "Malformed webhook payload" }, 400);
  }

  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(txRef).first();
  if (!order) return json({ error: "Order not found for this payment" }, 404);

  if (order.paymentStatus === "paid") {
    return json({ received: true, alreadyConfirmed: true });
  }

  // Never trust the webhook body's claimed status directly — re-verify the
  // transaction independently with Flutterwave's API using the secret key,
  // exactly like the redirect path does. This stops a forged webhook body
  // (even one that somehow had a valid-looking signature) from marking an
  // order paid without a real, confirmed transaction behind it.
  const flwData = await verifyFlutterwaveTransaction(transactionId, env);
  const result = await confirmAndFulfillOrder(env, order, flwData);

  return json({ received: true, confirmed: result.ok });
}
