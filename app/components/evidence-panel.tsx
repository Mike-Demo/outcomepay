"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type ArtifactView,
  type TeamView,
  type VerificationView,
} from "./api";

/** Bottom panel: run providers, verify artifacts, re-run with feedback. */
export default function EvidencePanel({
  outcomeId,
  teamTick,
  onStateChange,
}: {
  outcomeId: string | null;
  teamTick: number;
  onStateChange: () => void;
}) {
  const [team, setTeam] = useState<TeamView | null>(null);
  const [artifacts, setArtifacts] = useState<Record<string, ArtifactView[]>>({});
  const [verification, setVerification] = useState<VerificationView | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!outcomeId) return;
    try {
      const data = await api<{
        team: { provider_ids: string[]; total_usd: string } | null;
        artifacts: ArtifactView[];
        verification: VerificationView | null;
      }>(`/api/agents/outcome?id=${encodeURIComponent(outcomeId)}`);
      if (data.team) {
        const members = data.team.provider_ids.map((id) => ({ id, role: "", capability: "", price: 0, color: "#888" }));
        setTeam({ id: "", provider_ids: data.team.provider_ids, total_usd: data.team.total_usd, budget_usd: "", rejected: [], members });
      }
      const grouped: Record<string, ArtifactView[]> = {};
      for (const a of data.artifacts) {
        (grouped[a.provider_id] ||= []).push(a);
      }
      setArtifacts(grouped);
      setVerification(data.verification);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [outcomeId]);

  useEffect(() => {
    void fetchTeam();
  }, [fetchTeam, teamTick]);

  const runOne = async (providerId: string, feedback?: string) => {
    if (!outcomeId) return;
    setRunning(providerId);
    setError(null);
    try {
      const data = await api<{ artifacts: ArtifactView[]; mode: string }>("/api/agents/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId, providerId, feedback }),
      });
      setArtifacts((prev) => ({ ...prev, [providerId]: data.artifacts }));
      setVerification(null); // artifacts changed → verification is stale
      onStateChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  };

  const runAll = async () => {
    if (!team) return;
    for (const id of team.provider_ids) {
      await runOne(id);
    }
  };

  const runVerification = async () => {
    if (!outcomeId) return;
    setVerifying(true);
    setError(null);
    try {
      const data = await api<{ overall: "PASS" | "FAIL"; checks: VerificationView["checks"] }>(
        "/api/agents/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcomeId }),
        }
      );
      setVerification({ id: "", overall: data.overall, checks: data.checks, created_at: Date.now() });
      onStateChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVerifying(false);
    }
  };

  if (!outcomeId) {
    return <p className="muted">Artifacts land here as providers deliver — each one becomes evidence for verification.</p>;
  }
  if (!team) {
    return <p className="muted">Form the team above, then run the providers to produce artifacts.</p>;
  }

  const doneCount = team.provider_ids.filter((id) => (artifacts[id] ?? []).length > 0).length;
  const allDone = doneCount === team.provider_ids.length;
  const failedFeedback =
    verification && verification.overall === "FAIL"
      ? verification.checks.filter((c) => !c.passed).map((c) => `${c.id}: ${c.detail}`).join("\n")
      : null;

  return (
    <div className="ppanel">
      {error && <p className="err">{error}</p>}
      <div className="actions">
        <button className="btn btn-primary" onClick={runAll} disabled={running !== null}>
          {running ? `Running ${running}…` : `Run all providers (${doneCount}/${team.provider_ids.length})`}
        </button>
        {allDone && (
          <button className="btn" onClick={runVerification} disabled={verifying}>
            {verifying ? "Verifying…" : "Run verification"}
          </button>
        )}
      </div>

      {verification && (
        <div className={`verification ${verification.overall.toLowerCase()}`}>
          <h3>
            Verification: <span className={`badge ${verification.overall === "PASS" ? "selected" : "rejected"}`}>{verification.overall}</span>
          </h3>
          <ul className="checks">
            {verification.checks.map((c) => (
              <li key={c.id} className={c.passed ? "pass" : "fail"}>
                <strong>{c.passed ? "✓" : "✗"} {c.id}</strong>
                <span className="muted"> — {c.detail}</span>
              </li>
            ))}
          </ul>
          {verification.overall === "FAIL" && (
            <p className="muted">
              Payment is blocked. Re-run the responsible provider below — the failed check details go back in as feedback.
            </p>
          )}
        </div>
      )}

      <div className="artifact-grid">
        {team.provider_ids.map((id) => {
          const arts = artifacts[id] ?? [];
          return (
            <div key={id} className="artifact-card">
              <div className="bid-head">
                <strong>{id}</strong>
                {arts.length > 0 ? (
                  <span className={`badge ${arts[0].mode === "live" ? "selected" : "cached"}`}>{arts[0].mode}</span>
                ) : (
                  <button className="btn btn-sm" onClick={() => runOne(id)} disabled={running !== null}>
                    {running === id ? "Running…" : "Run"}
                  </button>
                )}
                {failedFeedback && arts.length > 0 && (
                  <button
                    className="btn btn-sm"
                    onClick={() => runOne(id, failedFeedback)}
                    disabled={running !== null}
                    title="Re-run with the failed check details as feedback"
                  >
                    {running === id ? "Re-running…" : "Re-run with feedback"}
                  </button>
                )}
              </div>
              {arts.length === 0 && <p className="muted">Not run yet.</p>}
              {arts.map((a, i) => (
                <details key={i} className="artifact">
                  <summary>
                    {a.title} <span className="muted">({a.kind} · {(a.content.length / 1024).toFixed(1)} KB)</span>
                  </summary>
                  {a.kind === "landing_page" ? (
                    <iframe title={a.title} srcDoc={a.content} className="preview-frame" sandbox="" />
                  ) : (
                    <pre className="preview">{a.content.slice(0, 4000)}</pre>
                  )}
                </details>
              ))}
            </div>
          );
        })}
      </div>
      <p className="muted fine">
        Artifacts are stored server-side with their full content for the verifiers.
      </p>
    </div>
  );
}
