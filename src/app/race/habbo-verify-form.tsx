"use client";

import { useState, type FormEvent } from "react";

export function HabboVerifyForm() {
  const [habboUsername, setHabboUsername] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const res = await fetch("/api/auth/habbo/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habboUsername }),
    });
    const data = await res.json();

    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setCode(data.code);
  }

  async function checkVerification() {
    setError(null);
    setPending(true);

    const res = await fetch("/api/auth/habbo/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habboUsername }),
    });
    const data = await res.json();

    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Not verified yet");
      return;
    }
    window.location.reload();
  }

  if (code) {
    return (
      <div>
        <p>Set your in-game motto to:</p>
        <p style={{ fontFamily: "monospace", fontSize: "1.4rem" }}>{code}</p>
        <button onClick={checkVerification} disabled={pending}>
          {pending ? "Checking…" : "I've set it — check now"}
        </button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={requestCode}>
      <label style={{ display: "block", marginBottom: 8 }}>
        Habbo username
        <input
          value={habboUsername}
          onChange={(event) => setHabboUsername(event.target.value)}
          required
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "…" : "Get verification code"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </form>
  );
}
