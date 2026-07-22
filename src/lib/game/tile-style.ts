export const TILE_STYLE: Record<string, { color: string; glyph: string; label: string }> = {
  unknown: { color: "#8b8fa3", glyph: "?", label: "Unknown" },
  merchant: { color: "#e0a868", glyph: "$", label: "Merchant" },
  treasure: { color: "#d4af37", glyph: "◆", label: "Treasure" },
  rest: { color: "#4d7c5f", glyph: "+", label: "Rest" },
  enemy: { color: "#b5495b", glyph: "!", label: "Enemy" },
  elite: { color: "#7a2e3a", glyph: "‼", label: "Elite" },
  checkpoint: { color: "#f2b134", glyph: "★", label: "Finish" },
};
