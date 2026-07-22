"use client";

import { useState, type FormEvent } from "react";
import { TILE_STYLE } from "@/lib/game/tile-style";

type RouteOption = {
  tileId: string;
  tileType: string;
  label: string | null;
  routeLabel: string | null;
};

export function RouteChoicePanel({ initialOptions }: { initialOptions: RouteOption[] }) {
  const [options, setOptions] = useState(initialOptions);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [done, setDone] = useState<"resolved" | "winner" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedTileId) return;

    setPending(true);
    setError(null);

    const res = await fetch("/api/race/choose-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toTileId: selectedTileId, code }),
    });
    const data = await res.json();

    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't confirm that choice");
      return;
    }

    setSelectedTileId(null);
    setCode("");
    if (data.pendingRoute) {
      setOptions(data.options);
    } else if (data.winner) {
      setDone("winner");
    } else {
      setDone("resolved");
    }
  }

  if (done) {
    return (
      <div style={{ border: "1px solid var(--accent)", borderRadius: 10, padding: "14px 16px" }}>
        {done === "winner" ? (
          <p style={{ fontWeight: 700 }}>You reached the finish line!</p>
        ) : (
          <p>Your path is confirmed.</p>
        )}
        <button onClick={() => window.location.reload()}>Done</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {options.map((option) => {
          const style = TILE_STYLE[option.tileType] ?? TILE_STYLE.unknown;
          const isSelected = option.tileId === selectedTileId;
          return (
            <button
              key={option.tileId}
              disabled={pending}
              onClick={() => setSelectedTileId(option.tileId)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                border: isSelected ? "1px solid var(--accent)" : "1px solid var(--line)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: isSelected ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: style.color,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0b0f14",
                  flexShrink: 0,
                }}
              >
                {style.glyph}
              </span>
              <span>
                {option.routeLabel && (
                  <span style={{ display: "block", fontSize: 11, textTransform: "uppercase", color: "var(--ink-soft)" }}>
                    {option.routeLabel}
                  </span>
                )}
                {option.label ?? style.label}
              </span>
            </button>
          );
        })}
      </div>

      {selectedTileId && (
        <form onSubmit={submit} style={{ marginTop: 14 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            Enter the codeword for this room
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoFocus
              required
              style={{ display: "block", marginTop: 4, width: "100%", maxWidth: 240 }}
            />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? "Checking…" : "Confirm"}
          </button>
        </form>
      )}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
