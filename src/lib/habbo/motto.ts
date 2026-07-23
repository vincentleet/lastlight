import { randomBytes } from "node:crypto";

export function generateVerificationCode(): string {
  return `LASTLIGHT-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export type HabboUser = { motto: string | null; figureString: string | null };

// Confirmed against the real endpoint: https://origins.habbo.com/api/public/users?name=<username>
// returns { uniqueId, name, figureString, motto, online, lastAccessTime, memberSince,
// profileVisible, ... }; a nonexistent username 404s.
export async function fetchHabboUser(username: string): Promise<HabboUser | null> {
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

  const data = (await response.json()) as { motto?: string; figureString?: string };
  return { motto: data.motto ?? null, figureString: data.figureString ?? null };
}

export async function fetchHabboMotto(username: string): Promise<string | null> {
  const user = await fetchHabboUser(username);
  return user?.motto ?? null;
}

export async function verifyMotto(username: string, expectedCode: string): Promise<boolean> {
  const motto = await fetchHabboMotto(username);
  return motto === expectedCode;
}

// Confirmed working (hosted on the main habbo.com domain regardless of
// which hotel/hotel-variant the figure string came from): a plain GET
// returns a real PNG.
export function getAvatarImageUrl(figureString: string): string {
  const params = new URLSearchParams({
    figure: figureString,
    size: "m",
    direction: "2",
    head_direction: "2",
    action: "std",
    gesture: "std",
  });
  return `https://www.habbo.com/habbo-imaging/avatarimage?${params.toString()}`;
}
