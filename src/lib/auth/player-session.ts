import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "ll_player";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 1 week — a race is expected to finish well before this

function getSecret(): string {
  const secret = process.env.PLAYER_SESSION_SECRET;
  if (!secret) {
    throw new Error("PLAYER_SESSION_SECRET is not set");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export async function mintPlayerSession(playerId: string) {
  const payload = JSON.stringify({ playerId, exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  const encoded = Buffer.from(payload).toString("base64url");
  const signature = sign(encoded);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${encoded}.${signature}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function getPlayerSession(): Promise<{ playerId: string } | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return null;

  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
    playerId: string;
    exp: number;
  };

  if (payload.exp < Date.now()) return null;

  return { playerId: payload.playerId };
}

export async function clearPlayerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
