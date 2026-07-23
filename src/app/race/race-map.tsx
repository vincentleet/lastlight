"use client";

import { useEffect, useState, type FormEvent } from "react";
import { TILE_STYLE } from "@/lib/game/tile-style";

type MapTile = {
  id: string;
  tileType: string;
  label: string | null;
  depth: number;
  row: number;
};

type MapEdge = { fromTileId: string; toTileId: string; routeLabel: string | null };

type MapState = {
  currentTileId: string | null;
  pendingRouteOptions: string[];
  tiles: MapTile[];
  edges: MapEdge[];
};

const COL_SPACING = 140;
const ROW_SPACING = 110;
const PADDING = 60;
const NODE_RADIUS = 28;

function position(tile: MapTile) {
  return { x: tile.depth * COL_SPACING + PADDING, y: tile.row * ROW_SPACING + PADDING };
}

export function RaceMap() {
  const [state, setState] = useState<MapState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/race/map", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load map");
      setState(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load map");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedTileId) return;

    setSubmitting(true);
    setFormError(null);

    const res = await fetch("/api/race/choose-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toTileId: selectedTileId, code }),
    });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setFormError(data.error ?? "Couldn't confirm that choice");
      return;
    }

    setSelectedTileId(null);
    setCode("");

    if (data.pendingRoute) {
      await load();
    } else {
      window.location.reload();
    }
  }

  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (!state) return <p>Loading map…</p>;

  const maxDepth = Math.max(0, ...state.tiles.map((t) => t.depth));
  const maxRow = Math.max(0, ...state.tiles.map((t) => t.row));
  const width = maxDepth * COL_SPACING + PADDING * 2;
  const height = maxRow * ROW_SPACING + PADDING * 2;
  const byId = new Map(state.tiles.map((t) => [t.id, t]));

  // Any tile directly reachable from where the player is standing can be
  // clicked to preview it — not just ones with a decision pending.
  const neighborIds = new Set(
    state.edges.filter((edge) => edge.fromTileId === state.currentTileId).map((edge) => edge.toTileId)
  );
  const pendingIds = new Set(state.pendingRouteOptions);
  const selectedTile = selectedTileId ? byId.get(selectedTileId) : null;
  const selectedIsPending = selectedTileId ? pendingIds.has(selectedTileId) : false;

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div>
        {pendingIds.size > 0 && !selectedTileId && (
          <p style={{ marginBottom: 8 }}>Choose your path — click a highlighted node below.</p>
        )}
        <div style={{ position: "relative", overflowX: "auto", maxWidth: "100%" }}>
          <svg width={width} height={height} style={{ minWidth: width, display: "block" }}>
            {state.edges.map((edge, i) => {
              const from = byId.get(edge.fromTileId);
              const to = byId.get(edge.toTileId);
              if (!from || !to) return null;
              const a = position(from);
              const b = position(to);
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--line)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              );
            })}
            {state.tiles.map((tile) => {
              const { x, y } = position(tile);
              const style = TILE_STYLE[tile.tileType] ?? TILE_STYLE.unknown;
              const isCurrent = tile.id === state.currentTileId;
              const isPending = pendingIds.has(tile.id);
              const isNeighbor = neighborIds.has(tile.id);
              const isClickable = isPending || isNeighbor;
              return (
                <g
                  key={tile.id}
                  onClick={
                    isClickable
                      ? () => {
                          setSelectedTileId(tile.id);
                          setFormError(null);
                          setCode("");
                        }
                      : undefined
                  }
                  style={isClickable ? { cursor: "pointer" } : undefined}
                >
                  {isCurrent && (
                    <circle cx={x} cy={y} r={NODE_RADIUS + 6} fill="none" stroke="var(--accent)" strokeWidth={3} />
                  )}
                  {isClickable && (
                    <circle
                      cx={x}
                      cy={y}
                      r={NODE_RADIUS + 6}
                      fill="none"
                      stroke={tile.id === selectedTileId ? "var(--accent)" : isPending ? "#f2b134" : "var(--line)"}
                      strokeWidth={isPending ? 3 : 2}
                      strokeDasharray={tile.id === selectedTileId ? undefined : "3 3"}
                    />
                  )}
                  <circle cx={x} cy={y} r={NODE_RADIUS} fill={style.color} />
                  <text x={x} y={y + 6} textAnchor="middle" fontSize={18} fill="#0b0f14" fontWeight={700}>
                    {style.glyph}
                  </text>
                  <text x={x} y={y + NODE_RADIUS + 16} textAnchor="middle" fontSize={11} fill="var(--ink-soft)">
                    {tile.label ?? style.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {selectedTile &&
            (() => {
              const { x, y } = position(selectedTile);
              const style = TILE_STYLE[selectedTile.tileType] ?? TILE_STYLE.unknown;
              return (
                <div
                  style={{
                    position: "absolute",
                    left: x,
                    top: y + NODE_RADIUS + 34,
                    transform: "translateX(-50%)",
                    background: style.color,
                    color: "#0b0f14",
                    borderRadius: 10,
                    padding: "12px 14px",
                    minWidth: 220,
                    zIndex: 1,
                    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.35)",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{selectedTile.label ?? style.label}</div>

                  {selectedIsPending ? (
                    <form onSubmit={submit}>
                      <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                        Enter the codeword for this room
                        <input
                          value={code}
                          onChange={(event) => setCode(event.target.value)}
                          autoFocus
                          required
                          style={{ display: "block", marginTop: 4, width: "100%" }}
                        />
                      </label>
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button type="submit" disabled={submitting}>
                          {submitting ? "Checking…" : "Confirm"}
                        </button>
                        <button type="button" onClick={() => setSelectedTileId(null)} disabled={submitting}>
                          Cancel
                        </button>
                      </div>
                      {formError && (
                        <p style={{ color: "crimson", fontSize: 12, marginTop: 6 }}>{formError}</p>
                      )}
                    </form>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, margin: 0 }}>{style.description}</p>
                      <button
                        type="button"
                        onClick={() => setSelectedTileId(null)}
                        style={{ marginTop: 8 }}
                      >
                        Close
                      </button>
                    </>
                  )}
                </div>
              );
            })()}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Legend</div>
        {Object.entries(TILE_STYLE).map(([type, style]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: style.color,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#0b0f14",
              }}
            >
              {style.glyph}
            </span>
            <span style={{ fontSize: 13 }}>{style.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
