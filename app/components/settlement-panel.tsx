"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type OutcomeStateView } from "./api";
import AllocationGrid from "./allocation-grid";

/**
 * Right-column: the settlement flow.
 * verify → human approves → settlement order → buyer approves at PayPal
 * → policy engine settles (the ONLY path that captures).
 */
export default function SettlementPanel({
  outcomeId,
  onStateChange,
}: {
  outcomeId: string | null;
  onStateChange: () => void;
}) {
  const [state, setState] = useState<OutcomeStateView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approveUrl, setApproveUrl] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any | null>(null);

  const fetchState = useCallback(async () => {
    if (!outcomeId) {
      setState(null);
      return;
    }
    try {
      const data = await api<OutcomeStateView>(`/api/agents/outcome?id=${encodeURIComponent(outcomeId)}`);
      setState(data);
      if (data.settlement?.capture_id) {
        // Reconstruct a compact receipt view from stored state.
        setReceipt((prev: any) =>
          prev ?? {
            paypalOrderId: data.settlement!.paypal_order_id,
            authorizationId: data.settlement!.authorization_id,
            captureId: data.settlement!.capture_id,
            amountUsd: data.settlement!.amount_usd,
            allocations: data.settlement!.allocations,
          }
        );
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [outcomeId]);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await fetchState();
      onStateChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!outcomeId) {
    return <p className="muted">Settlement unlocks once an outcome is published.</p>;
  }

  const verified = state?.verification?.overall === "PASS";
  const approved = !!state?.approval;
  const settled = !!state?.settlement?.capture_id;
  const teamTotal = state?.team?.total_usd ?? null;

  const approveOutcome = () =>
    outcomeId &&
    run("approve", async () => {
      await api("/api/agents/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId }),
      });
    });

  const prepare = () =>
    outcomeId &&
    run("prepare", async () => {
      const data = await api<{ approveUrl: string; paypalOrderId: string; allocations: unknown }>(
        "/api/agents/prepare-settlement",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcomeId }),
        }
      );
      setApproveUrl(data.approveUrl);
    });

  const settle = () =>
    outcomeId &&
    run("settle", async () => {
      const data = await api<{ receipt: unknown }>("/api/agents/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId }),
      });
      setReceipt(data.receipt);
      setApproveUrl(null);
    });

  return (
    <div className="ppanel settlement">
      {error && <p className="err">{error}</p>}

      <ol className="settle-steps">
        <li className={verified ? "done" : ""}>
          <strong>Verification</strong>
          <span className="muted">
            {state?.verification ? ` ${state.verification.overall}` : " — run it in the evidence timeline"}
          </span>
        </li>
        <li className={approved ? "done" : ""}>
          <strong>Human approval</strong>
          {approved ? (
            <span className="muted"> approved</span>
          ) : (
            <button className="btn btn-sm" onClick={approveOutcome} disabled={!verified || busy !== null}>
              {busy === "approve" ? "Approving…" : "Approve verified outcome"}
            </button>
          )}
        </li>
        <li className={state?.settlement ? "done" : ""}>
          <strong>Settlement order {teamTotal ? `($${Number(teamTotal).toFixed(2)})` : ""}</strong>
          {!state?.settlement && (
            <button className="btn btn-sm" onClick={prepare} disabled={!approved || busy !== null}>
              {busy === "prepare" ? "Creating…" : "Create PayPal order"}
            </button>
          )}
          {approveUrl && !settled && (
            <p>
              <a className="btn btn-primary btn-sm" href={approveUrl} target="_blank" rel="noreferrer">
                Approve at PayPal (sandbox)
              </a>
            </p>
          )}
          {state?.settlement && !settled && (
            <span className="muted"> order {state.settlement.paypal_order_id} — approve it at PayPal, then settle</span>
          )}
        </li>
        <li className={settled ? "done" : ""}>
          <strong>Policy engine settles</strong>
          {!settled && (
            <button className="btn btn-primary btn-sm" onClick={settle} disabled={!state?.settlement || busy !== null}>
              {busy === "settle" ? "Settling…" : "Settle via policy engine"}
            </button>
          )}
        </li>
      </ol>

      {receipt && (
        <div className="receipt">
          <h3>Settlement receipt</h3>
          <div className="kv">
            <div><dt>PayPal order</dt><dd className="mono">{receipt.paypalOrderId}</dd></div>
            <div><dt>Authorization</dt><dd className="mono">{receipt.authorizationId}</dd></div>
            <div><dt>Capture</dt><dd className="mono">{receipt.captureId}</dd></div>
            <div><dt>Amount</dt><dd>${Number(receipt.amountUsd).toFixed(2)}</dd></div>
          </div>
          {receipt.allocations && (
            <>
              <h4>Provider allocations</h4>
              <AllocationGrid allocations={receipt.allocations} />
              <p className="muted fine">Simulated internal ledger — not a PayPal payout.</p>
            </>
          )}
        </div>
      )}
      {!receipt && (
        <p className="muted fine">
          The policy engine is the only path that captures: it re-verifies freshness, requires your
          approval, then authorizes + captures the PayPal order.
        </p>
      )}
    </div>
  );
}
