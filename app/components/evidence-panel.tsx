"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ArtifactView, type TeamView } from "./api";

/** Bottom panel: run providers, collect artifacts as evidence. */
export default function EvidencePanel({
  outcomeId,
  teamTick,
}: {
  outcomeId: string | null;
  teamTick: number;
}) {
  const [team, setTeam] = useState<TeamView | null>(null);
  const [artifacts, setArtifacts] = useState<Record<string, ArtifactView[]>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!outcomeId) return;
    try {
      const data = await api<{
        team: { provider_ids: string[]; total_usd: string } | null;
        artifacts: Array<ArtifactView & { provider_id: string }>;
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
    } catch (e) {
      setError((e as Error).message);
    }
  }, [outcomeId]);

  useEffect(() => {
    void fetchTeam();
  }, [fetchTeam, teamTick]);

  const runOne = async (providerId: string) => {
    if (!outcomeId) return;
    setRunning(providerId);
    setError(null);
    try {
      const data = await api<{ artifacts: ArtifactView[]; mode: string }>("/api/agents/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId, providerId }),
      });
      setArtifacts((prev) => ({ ...prev, [providerId]: data.artifacts }));
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

  if (!outcomeId) {
    return <p className="muted">Artifacts land here as providers deliver — each one becomes evidence for verification.</p>;
  }
  if (!team) {
    return <p className="muted">Form the team above, then run the providers to produce artifacts.</p>;
  }

  const doneCount = team.provider_ids.filter((id) => (artifacts[id] ?? []).length > 0).length;

  return (
    <div className="ppanel">
      {error && <p className="err">{error}</p>}
      <div className="actions">
        <button className="btn btn-primary" onClick={runAll} disabled={running !== null}>
          {running ? `Running ${running}…` : `Run all providers (${doneCount}/${team.provider_ids.length})`}
        </button>
      </div>
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
        Artifacts are stored server-side with their full content for the Phase 3 verifiers.
      </p>
    </div>
  );
}
