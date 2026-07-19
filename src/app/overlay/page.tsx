"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type OverlayState = {
  race: { id: string; status: string; currentTurnIndex: number | null } | null;
  roster: Array<{
    id: string;
    habboUsername: string | null;
    turnOrderIndex: number;
    commonResource: number;
    rareResource: number;
  }>;
};

export default function OverlayPage() {
  const [state, setState] = useState<OverlayState>({ race: null, roster: [] });

  useEffect(() => {
    let active = true;

    async function load() {
      const res = await fetch("/api/overlay/state", { cache: "no-store" });
      const data = (await res.json()) as OverlayState;
      if (active) setState(data);
    }

    load();

    // Requires replication enabled on the races/players tables in the
    // Supabase dashboard (Database -> Replication).
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("overlay")
      .on("postgres_changes", { event: "*", schema: "public", table: "races" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main style={{ background: "transparent", color: "white", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      {!state.race ? (
        <p>Waiting for a race…</p>
      ) : (
        <>
          <h2 style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>Last Light</h2>
          <ol>
            {state.roster.map((player) => (
              <li
                key={player.id}
                style={{
                  fontWeight: state.race?.currentTurnIndex === player.turnOrderIndex ? 700 : 400,
                }}
              >
                {player.habboUsername ?? "—"} · {player.commonResource}c / {player.rareResource}r
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}
