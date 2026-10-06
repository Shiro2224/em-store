// Shared Flutterwave payment logic, used by both functions/api/payments/verify.js
// (the redirect-back path) and functions/api/payments/webhook.js (the
// server-to-server path). Keeping this in one place means both paths apply
// the exact same rules for when an order is actually allowed to be marked
// paid and stock actually deducted.

const FLW_BASE = "https://api.flutterwave.com/v3";

// Calls Flutterwave's own "verify transaction" endpoint using the SECRET key.
// This is the only source of truth for whether a payment really succeeded —
// we never trust a status string sent to us by the browser or a webhook body
// on its own; we always ask Flutterwave directly to confirm it.
export async function verifyFlutterwaveTransaction(transactionId, env) {
  if (!env.FLW_SECRET_KEY) {
    throw new Error(
      "FLW_SECRET_KEY is not set yet. This is expected until Flutterwave credentials are added — see README."
    );
  }
  const res = await fetch(`${FLW_BASE}/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${env.FLW_SECRET_KEY}` },
  });
  const data = await res.json();
  return data; // data.status, data.data.status, data.data.amount, data.data.currency, data.data.tx_ref, etc.
}

// Takes Flutterwave's verification response + the order it claims to be for,
// and — only if everything genuinely checks out — marks the order paid and
// deducts stock. Safe to call more than once for the same payment (e.g. both
// the webhook and the redirect page calling it for the same transaction):
// the conditional UPDATE below only succeeds the FIRST time, so stock is
// never deducted twice for one order.
export async function confirmAndFulfillOrder(env, order, flwResponseData) {
  const txData = flwResponseData && flwResponseData.data;
  const genuinelySuccessful =
    flwResponseData &&
    flwResponseData.status === "success" &&
    txData &&
    txData.status === "successful" &&
    txData.tx_ref === order.id &&
    Number(txData.amount) >= Number(order.total) &&
    String(txData.currency).toUpperCase() === "NGN";

  if (!genuinelySuccessful) {
    // Payment did not actually succeed — mark as failed (only if it was
    // still pending; never downgrade an order that's already 'paid').
    await env.DB.prepare("UPDATE orders SET paymentStatus = 'failed' WHERE id = ? AND paymentStatus = 'pending'")
      .bind(order.id)
      .run();
    return { ok: false, reason: "Payment could not be verified as successful." };
  }

  // Atomically flip pending -> paid. If this order was already marked paid
  // by the other verification path (webhook vs redirect racing each other),
  // `meta.changes` will be 0 here, and we correctly skip deducting stock again.
  const update = await env.DB.prepare(
    "UPDATE orders SET paymentStatus = 'paid', flwTransactionId = ? WHERE id = ? AND paymentStatus = 'pending'"
  )
    .bind(String(txData.id), order.id)
    .run();

  const wasFirstConfirmation = update.meta && update.meta.changes > 0;

  if (wasFirstConfirmation) {
    const items = JSON.parse(order.items);
    for (const item of items) {
      // Floor at 0 rather than ever going negative, in the rare case stock
      // changed between order creation and payment confirmation.
      await env.DB.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?")
        .bind(item.qty, item.id)
        .run();
    }
  }

  return { ok: true, alreadyConfirmed: !wasFirstConfirmation };
}
