import { randomBytes } from "node:crypto";

export function generateVerificationCode(): string {
  return `LASTLIGHT-${randomBytes(2).toString("hex").toUpperCase()}`;
}

// Confirmed against the real endpoint: https://origins.habbo.com/api/public/users?name=<username>
// returns { uniqueId, name, figureString, motto, online, lastAccessTime, memberSince,
// profileVisible, ... }; a nonexistent username 404s.
export async function fetchHabboMotto(username: string): Promise<string | null> {
  const base = process.env.HABBO_API_BASE_URL;
  if (!base) {
    throw new Error("HABBO_API_BASE_URL is not set");
  }

  const response = await fetch(`${base}/users?name=${encodeURIComponent(username)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { motto?: string };
  return data.motto ?? null;
}

export async function verifyMotto(username: string, expectedCode: string): Promise<boolean> {
  const motto = await fetchHabboMotto(username);
  return motto === expectedCode;
}
