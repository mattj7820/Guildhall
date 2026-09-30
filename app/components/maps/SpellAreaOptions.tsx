import { COMMON_SPELL_SIZES, SPELL_SHAPES, type SpellShape } from "~/maps/grid/shapes";
import { floatingPanelClass, ToolIcon, toolButtonClass } from "./MapToolbar";

const SHAPE_ICONS: Record<SpellShape, string> = {
  sphere: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",
  cube: "M5 5h14v14H5z",
  cone: "M4 12 20 4v16z",
  line: "M3 10h18v4H3z",
};

/** Named as spell descriptions name them, so players recognise what they read. */
const SHAPE_NAMES: Record<SpellShape, string> = {
  sphere: "Sphere",
  cube: "Cube",
  cone: "Cone",
  line: "Line",
};

interface Props {
  shape: SpellShape;
  feet: number;
  onShape: (shape: SpellShape) => void;
  onFeet: (feet: number) => void;
}

/** The spell area tool's choices, beside the map's toolbar: which shape, and how big. */
export function SpellAreaOptions({ shape, feet, onShape, onFeet }: Props) {
  return (
    <div
      role="group"
      aria-label="Spell area"
      className={`${floatingPanelClass} flex flex-col gap-1`}
    >
      <div role="group" aria-label="Shape" className="flex gap-1">
        {SPELL_SHAPES.map((each) => (
          <button
            key={each}
            type="button"
            aria-pressed={shape === each}
            className={`${toolButtonClass(shape === each)} text-sm font-semibold`}
            onClick={() => onShape(each)}
          >
            <ToolIcon d={SHAPE_ICONS[each]} />
            {SHAPE_NAMES[each]}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Size" className="flex gap-1">
        {COMMON_SPELL_SIZES.map((each) => (
          <button
            key={each}
            type="button"
            aria-pressed={feet === each}
            className={`${toolButtonClass(feet === each)} text-xs font-semibold`}
            onClick={() => onFeet(each)}
          >
            {each} ft
          </button>
        ))}
      </div>
    </div>
  );
}
