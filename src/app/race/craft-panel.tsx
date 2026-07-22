"use client";

import { useState } from "react";
import { formatEffectLabel } from "@/lib/game/effect-labels";
import type { DiceFace } from "@/components/DiceBoxes";

type Upgrade = {
  id: string;
  name: string;
  description: string | null;
  costCommon: number;
  costRare: number;
  effectType: string;
  magnitude: number;
  resourceType: string | null;
};

export function CraftPanel({
  upgrades,
  playerFaces,
  commonResource,
  rareResource,
}: {
  upgrades: Upgrade[];
  playerFaces: DiceFace[];
  commonResource: number;
  rareResource: number;
}) {
  const [selectedUpgradeId, setSelectedUpgradeId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byFace = new Map(playerFaces.map((f) => [f.faceValue, f]));
  const selectedUpgrade = upgrades.find((u) => u.id === selectedUpgradeId) ?? null;

  async function install(faceValue: number) {
    if (!selectedUpgrade) return;
    setPending(true);
    setError(null);

    const res = await fetch("/api/race/craft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ craftableUpgradeId: selectedUpgrade.id, faceValue }),
    });
    const data = await res.json();

    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Purchase failed");
      return;
    }
    window.location.reload();
  }

  if (upgrades.length === 0) {
    return <p style={{ color: "var(--ink-soft)" }}>No upgrades available yet.</p>;
  }

  return (
    <div>
      {!selectedUpgrade ? (
        <div style={{ display: "grid", gap: 10 }}>
          {upgrades.map((upgrade) => {
            const affordable = commonResource >= upgrade.costCommon && rareResource >= upgrade.costRare;
            return (
              <div
                key={upgrade.id}
                style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{upgrade.name}</div>
                    {upgrade.description && (
                      <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{upgrade.description}</div>
                    )}
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      {formatEffectLabel(upgrade.effectType, upgrade.magnitude, upgrade.resourceType)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, marginBottom: 6 }}>
                      {upgrade.costCommon > 0 && `${upgrade.costCommon} common`}
                      {upgrade.costCommon > 0 && upgrade.costRare > 0 && " + "}
                      {upgrade.costRare > 0 && `${upgrade.costRare} rare`}
                    </div>
                    <button disabled={!affordable} onClick={() => setSelectedUpgradeId(upgrade.id)}>
                      {affordable ? "Buy" : "Can't afford"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <p>
            Choose a slot for <strong>{selectedUpgrade.name}</strong> — this replaces that face&apos;s current
            effect.
          </p>
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5, 6].map((value) => {
              const current = byFace.get(value);
              return (
                <button
                  key={value}
                  disabled={pending}
                  onClick={() => install(value)}
                  style={{ textAlign: "left", padding: "8px 12px" }}
                >
                  Face {value}: {current ? formatEffectLabel(current.effectType, current.magnitude, current.resourceType) : "Not set"}{" "}
                  → {formatEffectLabel(selectedUpgrade.effectType, selectedUpgrade.magnitude, selectedUpgrade.resourceType)}
                </button>
              );
            })}
          </div>
          <button onClick={() => setSelectedUpgradeId(null)} disabled={pending}>
            Cancel
          </button>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
