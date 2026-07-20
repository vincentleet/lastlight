"use client";

import { useEffect, useState } from "react";

type MapTile = {
  id: string;
  tileType: string;
  label: string | null;
  depth: number;
  row: number;
};

type MapEdge = { fromTileId: string; toTileId: string; routeLabel: string | null };

type MapState = { currentTileId: string | null; tiles: MapTile[]; edges: MapEdge[] };

const TILE_STYLE: Record<string, { color: string; glyph: string; label: string }> = {
  unknown: { color: "#8b8fa3", glyph: "?", label: "Unknown" },
  merchant: { color: "#e0a868", glyph: "$", label: "Merchant" },
  treasure: { color: "#d4af37", glyph: "◆", label: "Treasure" },
  rest: { color: "#4d7c5f", glyph: "+", label: "Rest" },
  enemy: { color: "#b5495b", glyph: "!", label: "Enemy" },
  elite: { color: "#7a2e3a", glyph: "‼", label: "Elite" },
  checkpoint: { color: "#f2b134", glyph: "★", label: "Finish" },
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

  useEffect(() => {
    let active = true;

    fetch("/api/race/map")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load map");
        return res.json();
      })
      .then((data) => active && setState(data))
      .catch((err) => active && setError(err.message));

    return () => {
      active = false;
    };
  }, []);

  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (!state) return <p>Loading map…</p>;

  const maxDepth = Math.max(0, ...state.tiles.map((t) => t.depth));
  const maxRow = Math.max(0, ...state.tiles.map((t) => t.row));
  const width = maxDepth * COL_SPACING + PADDING * 2;
  const height = maxRow * ROW_SPACING + PADDING * 2;
  const byId = new Map(state.tiles.map((t) => [t.id, t]));

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <svg width={width} height={height} style={{ minWidth: width }}>
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
            return (
              <g key={tile.id}>
                {isCurrent && (
                  <circle cx={x} cy={y} r={NODE_RADIUS + 6} fill="none" stroke="var(--accent)" strokeWidth={3} />
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
