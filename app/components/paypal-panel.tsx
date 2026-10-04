"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Phase 1 test harness for the PayPal spine, embedded in the command center.
 * Click-through: create order (AUTHORIZE) → approve in the PayPal sandbox →
 * authorize → capture. Every state change is persisted server-side and the
 * real PayPal IDs are shown.
 */

interface SpineOrder {
  id: string;
  paypalOrderId: string;
  approveUrl?: string;
  status: string;
  amountUsd: string;
  description?: string;
  authorizationId?: string | null;
  captureId?: string | null;
}

const STEPS = ["CREATED", "APPROVED", "AUTHORIZED", "CAPTURED"] as const;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string } & T;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

export default function PaypalPanel() {
  const [amount, setAmount] = useState("40.00");
  const [description, setDescription] = useState("OutcomePay golden-scenario budget");
  const [order, setOrder] = useState<SpineOrder | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const booted = useRef(false);

  const refresh = useCallback(async (paypalOrderId: string) => {
    setBusy("refresh");
    setError(null);
    try {
      const data = await api<{ order: SpineOrder }>(
        `/api/paypal/order?id=${encodeURIComponent(paypalOrderId)}`
      );
      setOrder((prev) => ({ ...data.order, approveUrl: prev?.approveUrl }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, []);

  // Pick up the PayPal redirect (?paypal_order= / ?paypal_cancelled=1).
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const q = new URLSearchParams(window.location.search);
    const oid = q.get("paypal_order");
    if (q.get("paypal_cancelled") === "1") {
      setNotice("Buyer cancelled at PayPal — no money moved.");
      window.history.replaceState(null, "", window.location.pathname);
    } else if (oid) {
      setNotice("Back from PayPal — refreshing order status…");
      setOrder({ id: "", paypalOrderId: oid, status: "CREATED", amountUsd: "" });
      void refresh(oid).finally(() => setNotice(null));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const create = () =>
    run("create", async () => {
      const data = await api<{ order: SpineOrder }>("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: amount, description }),
      });
      setOrder(data.order);
    });

  const authorize = () =>
    order &&
    run("authorize", async () => {
      const data = await api<{ authorizationId: string; status: string }>("/api/paypal/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.paypalOrderId }),
      });
      setOrder({ ...order, status: data.status, authorizationId: data.authorizationId });
    });

  const capture = () =>
    order &&
    run("capture", async () => {
      const data = await api<{ captureId: string; status: string }>("/api/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.paypalOrderId, authorizationId: order.authorizationId }),
      });
      setOrder({ ...order, status: data.status, captureId: data.captureId });
    });

  const reset = () => {
    setOrder(null);
    setError(null);
    setNotice(null);
  };

  const stepIdx = order ? STEPS.indexOf(order.status as (typeof STEPS)[number]) : -1;

  return (
    <div className="ppanel">
      {notice && <p className="notice">{notice}</p>}
      {error && <p className="err">{error}</p>}

      {!order && (
        <>
          <label className="field">
            <span>Amount (USD)</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </label>
          <label className="field">
            <span>Description</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} />
          </label>
          <button className="btn btn-primary" onClick={create} disabled={busy !== null}>
            {busy === "create" ? "Creating…" : "Create order (AUTHORIZE)"}
          </button>
        </>
      )}

      {order && (
        <>
          <ol className="mini-steps">
            {STEPS.map((s, i) => (
              <li key={s} className={i < stepIdx ? "done" : i === stepIdx ? "current" : ""}>
                {s}
              </li>
            ))}
          </ol>

          <dl className="kv">
            <div>
              <dt>Order ID</dt>
              <dd className="mono">{order.paypalOrderId}</dd>
            </div>
            {order.authorizationId && (
              <div>
                <dt>Auth ID</dt>
                <dd className="mono">{order.authorizationId}</dd>
              </div>
            )}
            {order.captureId && (
              <div>
                <dt>Capture ID</dt>
                <dd className="mono">{order.captureId}</dd>
              </div>
            )}
            {order.amountUsd && (
              <div>
                <dt>Amount</dt>
                <dd>${order.amountUsd} USD</dd>
              </div>
            )}
          </dl>

          <div className="actions">
            {order.status === "CREATED" && order.approveUrl && (
              <a className="btn btn-primary" href={order.approveUrl} target="_blank" rel="noreferrer">
                Approve in PayPal sandbox ↗
              </a>
            )}
            {order.status === "CREATED" && (
              <button className="btn" onClick={() => refresh(order.paypalOrderId)} disabled={busy !== null}>
                {busy === "refresh" ? "Refreshing…" : "Refresh status"}
              </button>
            )}
            {order.status === "APPROVED" && (
              <button className="btn btn-primary" onClick={authorize} disabled={busy !== null}>
                {busy === "authorize" ? "Authorizing…" : "Authorize (hold budget)"}
              </button>
            )}
            {order.status === "AUTHORIZED" && (
              <button className="btn btn-primary" onClick={capture} disabled={busy !== null}>
                {busy === "capture" ? "Capturing…" : "Capture payment"}
              </button>
            )}
            {order.status === "CAPTURED" && (
              <>
                <p className="success">✓ Payment captured in the PayPal sandbox.</p>
                <button className="btn" onClick={reset}>
                  Start over
                </button>
              </>
            )}
          </div>
        </>
      )}

      <p className="muted fine">
        Phase 1 test harness · sandbox only — not a legal escrow service.
      </p>
    </div>
  );
}
