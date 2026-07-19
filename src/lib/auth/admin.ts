import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function getAllowedDiscordIds(): string[] {
  return (process.env.ADMIN_DISCORD_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const discordId = user.identities?.find((identity) => identity.provider === "discord")?.id;

  if (!discordId || !getAllowedDiscordIds().includes(discordId)) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=not_allowed");
  }

  return user;
}
