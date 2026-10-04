"use client";

import { useState } from "react";
import { api, type ContractView } from "./api";
import { GOLDEN_GOAL } from "../../lib/outcome-contract";

/** Left panel: publish the outcome → buyer agent builds the contract. */
export default function OutcomePanel({ onPublished }: { onPublished: (id: string) => void }) {
  const [goal, setGoal] = useState(GOLDEN_GOAL);
  const [budget, setBudget] = useState("40");
  const [contract, setContract] = useState<ContractView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ outcome: { id: string; contract: ContractView } }>("/api/agents/outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, budgetUsd: Number(budget) }),
      });
      setContract(data.outcome.contract);
      onPublished(data.outcome.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ppanel">
      {error && <p className="err">{error}</p>}
      <label className="field">
        <span>Desired outcome (plain language)</span>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} />
      </label>
      <label className="field">
        <span>Budget (USD)</span>
        <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" />
      </label>
      <button className="btn btn-primary" onClick={publish} disabled={busy || !goal.trim()}>
        {busy ? "Publishing…" : "Publish outcome"}
      </button>

      {contract && (
        <div className="contract">
          <h3>Outcome contract v{contract.contract_version}</h3>
          <p className="scenario">“{contract.goal}”</p>
          <div className="kv">
            <div>
              <dt>Budget</dt>
              <dd>${contract.budget.toFixed(2)} {contract.currency}</dd>
            </div>
            <div>
              <dt>Policy</dt>
              <dd>human approval required · capture after verification</dd>
            </div>
          </div>
          <div className="chips">
            {contract.deliverables.map((d) => (
              <span key={d} className="chip">{d}</span>
            ))}
          </div>
          <div className="chips">
            {contract.acceptance_tests.map((t) => (
              <span key={t} className="chip ghost">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
