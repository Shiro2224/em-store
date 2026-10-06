import { json, corsPreflight } from "../../_helpers/utils.js";
import { verifyFlutterwaveTransaction, confirmAndFulfillOrder } from "../../_helpers/payment.js";

export async function onRequestOptions() {
  return corsPreflight();
}

// GET /api/payments/verify?transaction_id=...&tx_ref=...
//
// Called by the frontend right after Flutterwave redirects the customer
// back to the site. This is the "did they actually pay?" check — it asks
// Flutterwave directly (using the secret key) rather than trusting the
// status shown in the URL, which a customer could otherwise tamper with.
//
// This only ever marks an order paid if Flutterwave itself confirms the
// transaction was successful, for the right order, for the right amount,
// in Naira. See functions/_helpers/payment.js for the exact checks.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const transactionId = url.searchParams.get("transaction_id");
  const txRef = url.searchParams.get("tx_ref");

  if (!transactionId || !txRef) {
    return json({ error: "Missing transaction_id or tx_ref" }, 400);
  }

  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(txRef).first();
  if (!order) return json({ error: "Order not found for this payment" }, 404);

  // Order already confirmed earlier (e.g. the webhook got there first) —
  // nothing more to do, just report success.
  if (order.paymentStatus === "paid") {
    return json({ verified: true, orderId: order.id, total: order.total, alreadyConfirmed: true });
  }

  let flwData;
  try {
    flwData = await verifyFlutterwaveTransaction(transactionId, env);
  } catch (e) {
    return json({ verified: false, error: e.message }, 503);
  }

  const result = await confirmAndFulfillOrder(env, order, flwData);

  if (!result.ok) {
    return json({ verified: false, orderId: order.id, error: result.reason });
  }

  return json({ verified: true, orderId: order.id, total: order.total, alreadyConfirmed: result.alreadyConfirmed });
}
