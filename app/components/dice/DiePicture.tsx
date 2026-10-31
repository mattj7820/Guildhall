import { useEffect, useRef, useState } from "react";
import type { DieStyle, DieType } from "~/dice/styles";
import { DieIcon } from "./DieIcon";
import { styleLook } from "./looks";

/**
 * A die in its style as a still 3D picture, patterns and all; the flat outline until it's drawn,
 * or where WebGL isn't there. Decorative.
 */
export function DiePicture({
  sides,
  style,
  size = 56,
}: {
  sides: DieType;
  style: Pick<DieStyle, "look">;
  size?: number;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const [picture, setPicture] = useState<string>();
  useEffect(() => {
    const within = box.current;
    if (!within) return;
    let cancelled = false;
    void import("~/dice/tray/picture").then(({ pictureOf }) => {
      if (!cancelled) setPicture(pictureOf(sides, styleLook(style)(within)));
    });
    return () => {
      cancelled = true;
    };
  }, [sides, style]);
  return (
    <span ref={box} aria-hidden="true" className="shrink-0" style={{ width: size, height: size }}>
      {picture ? (
        <img src={picture} alt="" width={size} height={size} />
      ) : (
        <DieIcon sides={sides} style={style} size={size} />
      )}
    </span>
  );
}
