import Image from "next/image";
import { formatEffectLabel } from "@/lib/game/effect-labels";

export type DiceFace = {
  faceValue: number;
  effectType: string;
  magnitude: number;
  resourceType?: string | null;
};

function DieImage({ faceValue, size }: { faceValue: number; size: number }) {
  return (
    <Image
      src={`/dice/${faceValue}.png`}
      alt={`Dice face ${faceValue}`}
      width={size}
      height={size}
      unoptimized
      style={{ flexShrink: 0, imageRendering: "pixelated" }}
    />
  );
}

export function DiceBoxes({
  faces,
  activeFaceValue,
  compact = false,
}: {
  faces: DiceFace[];
  activeFaceValue?: number | null;
  compact?: boolean;
}) {
  const byFace = new Map(faces.map((f) => [f.faceValue, f]));
  const boxSize = compact ? 32 : 44;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
      {[1, 2, 3, 4, 5, 6].map((value) => {
        const face = byFace.get(value);
        const isActive = activeFaceValue === value;
        return (
          <div
            key={value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: compact ? "6px 10px" : "8px 12px",
              border: isActive ? "1px solid var(--accent)" : "1px solid var(--line)",
              borderRadius: 10,
              background: isActive ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
            }}
          >
            <DieImage faceValue={value} size={boxSize} />
            <span style={{ fontSize: compact ? 12 : 13 }}>
              {face ? formatEffectLabel(face.effectType, face.magnitude, face.resourceType) : "Not set"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
