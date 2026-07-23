export const TILE_STYLE: Record<string, { color: string; glyph: string; label: string; description: string }> = {
  unknown: {
    color: "#8b8fa3",
    glyph: "?",
    label: "Unknown",
    description: "A random event — you won't know what happens until you're there.",
  },
  merchant: {
    color: "#e0a868",
    glyph: "$",
    label: "Merchant",
    description: "Spend resources on dice upgrades.",
  },
  treasure: {
    color: "#d4af37",
    glyph: "◆",
    label: "Treasure",
    description: "A guaranteed resource reward.",
  },
  rest: {
    color: "#4d7c5f",
    glyph: "+",
    label: "Rest",
    description: "A safe stop — nothing happens here.",
  },
  enemy: {
    color: "#b5495b",
    glyph: "!",
    label: "Enemy",
    description: "A standard fight awaits.",
  },
  elite: {
    color: "#7a2e3a",
    glyph: "‼",
    label: "Elite",
    description: "A tougher fight — bigger risk, bigger reward.",
  },
  checkpoint: {
    color: "#f2b134",
    glyph: "★",
    label: "Finish",
    description: "The finish line.",
  },
};
