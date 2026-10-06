import type { ReactNode } from "react";
import { Link } from "react-router";
import { buttonClass, primaryButtonClass } from "~/components/styles";
import type { MapView } from "~/maps/types";
import { mapEditUrl } from "~/maps/urls";
import { MapSwitch } from "./MapSwitch";

/**
 * The DM's bar over the map: stunt settings, sharing and snapping, and the switches between the
 * map's modes (Combat, Stunts, Fog), presenting, and the editor.
 */
export function MapViewerBar({
  map,
  stunts,
  combat,
  stuntMode,
  fogMode,
  onCombat,
  onStunts,
  onFog,
  onPresent,
}: {
  map: MapView;
  /** The stunt settings menu. */
  stunts: ReactNode;
  combat: boolean;
  stuntMode: boolean;
  fogMode: boolean;
  onCombat: () => void;
  onStunts: () => void;
  onFog: () => void;
  onPresent: () => void;
}) {
  const mode = (label: string, on: boolean, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      className={on ? primaryButtonClass : buttonClass}
      onClick={onClick}
    >
      {label}
    </button>
  );
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      {stunts}
      <MapSwitch
        mapId={map.id}
        label="Share with players"
        on={!!map.shared}
        change={(on) => ({ intent: "setVisibility", visibility: on ? "players" : "dm" })}
      />
      {map.grid && (
        <MapSwitch
          mapId={map.id}
          label="Snap to grid"
          on={!!map.snapToGrid}
          change={(snap) => ({ intent: "setSnapping", snap })}
        />
      )}
      {mode("Combat", combat, onCombat)}
      {mode("Stunts", stuntMode, onStunts)}
      {mode("Fog", fogMode, onFog)}
      <button type="button" className={buttonClass} onClick={onPresent}>
        Present
      </button>
      {/* PROTOTYPE (removed before the PR) */}
      <Link to={`/maps/${map.id}/tokens-prototype`} className={buttonClass}>
        Tokens tab (prototype)
      </Link>
      <Link to={mapEditUrl(map.id)} className={buttonClass}>
        Edit map
      </Link>
    </div>
  );
}
