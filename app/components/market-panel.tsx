"use client";

import { useState } from "react";
import { api, type BidView, type TeamView } from "./api";

/** Center panel: broker solicits bids, then forms the team under budget. */
export default function MarketPanel({
  outcomeId,
  onTeamFormed,
}: {
  outcomeId: string | null;
  onTeamFormed: () => void;
}) {
  const [bids, setBids] = useState<BidView[] | null>(null);
  const [team, setTeam] = useState<TeamView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const requestBids = () =>
    outcomeId &&
    run("bids", async () => {
      const data = await api<{ bids: BidView[] }>("/api/agents/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId }),
      });
      setBids(data.bids);
      setTeam(null);
    });

  const formTeam = () =>
    outcomeId &&
    run("team", async () => {
      const data = await api<{ team: TeamView }>("/api/agents/form-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId }),
      });
      setTeam(data.team);
      onTeamFormed();
    });

  if (!outcomeId) {
    return <p className="muted">Publish an outcome first — then the broker recruits provider agents here.</p>;
  }

  const selected = bids?.filter((b) => b.decision === "selected") ?? [];
  const selectedTotal = selected.reduce((s, b) => s + b.price, 0);

  return (
    <div className="ppanel">
      {error && <p className="err">{error}</p>}
      <div className="actions">
        <button className="btn btn-primary" onClick={requestBids} disabled={busy !== null}>
          {busy === "bids" ? "Soliciting…" : "Request bids"}
        </button>
        {bids && !team && (
          <button className="btn" onClick={formTeam} disabled={busy !== null}>
            {busy === "team" ? "Forming…" : `Form team ($${selectedTotal.toFixed(2)})`}
          </button>
        )}
      </div>

      {bids && (
        <div className="bid-grid">
          {bids.map((b) => (
            <div key={b.provider_id} className={`bid-card ${b.decision}`}>
              <div className="bid-head">
                <span className="swatch" style={{ background: b.color }} />
                <strong>{b.provider_id}</strong>
                <span className={`badge ${b.decision}`}>{b.decision}</span>
              </div>
              <div className="bid-sub">{b.role} · {b.capability}</div>
              <div className="bid-sub muted">{b.blurb}</div>
              <div className="bid-meta">
                <span className="price">${b.price.toFixed(2)}</span>
                <span className="conf" title={`confidence ${b.confidence}`}>
                  <i style={{ width: `${Math.round(b.confidence * 100)}%` }} />
                </span>
                <span className="muted">{Math.round(b.confidence * 100)}%</span>
              </div>
              {b.decision === "rejected" && b.decision_reason && (
                <div className="reject-reason">{b.decision_reason}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {team && (
        <div className="team-summary">
          <h3>
            Team formed — ${team.total_usd} of ${team.budget_usd} budget
          </h3>
          <div className="team-bar">
            <i style={{ width: `${Math.min(100, (Number(team.total_usd) / Number(team.budget_usd)) * 100)}%` }} />
          </div>
          <ul className="agents">
            {team.members.map((m) => (
              <li key={m.id}>
                <span className="swatch" style={{ background: m.color }} />
                <strong>{m.id}</strong>
                <span className="muted"> — {m.role} · ${m.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <p className="muted fine">Phase 3 wires team formation to the PayPal AUTHORIZE step.</p>
        </div>
      )}
    </div>
  );
}
