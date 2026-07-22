export function formatEffectLabel(effectType: string, magnitude: number, resourceType?: string | null): string {
  switch (effectType) {
    case "move":
      return `Move ${magnitude} block${magnitude === 1 ? "" : "s"}`;
    case "grant_resource":
      return `+${magnitude} ${resourceType === "rare" ? "Rare" : "Coin"}${magnitude === 1 ? "" : "s"}`;
    case "steal_resource":
      return `Steal ${magnitude} ${resourceType === "rare" ? "Rare" : "Coin"}${magnitude === 1 ? "" : "s"}`;
    case "block_player":
      return "Block a player";
    case "reroll":
      return "Reroll";
    case "skip_hazard":
      return "Skip hazard";
    case "special_event":
      return "Special event";
    case "noop":
      return "Nothing";
    default:
      return effectType;
  }
}
