import { randomBytes } from "node:crypto";

export function generateVerificationCode(): string {
  return `LL-${randomBytes(3).toString("hex").toUpperCase()}`;
}

// Confirm this shape against Habbo Origins' actual public API before relying
// on it — HABBO_API_BASE_URL and the { motto } response field are a best
// guess, not a verified integration.
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
