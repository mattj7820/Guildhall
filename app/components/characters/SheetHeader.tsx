import type { TextField as TextFieldName } from "~/characters/actions";
import { LEVEL_MAX, SHORT_TEXT_MAX } from "~/characters/schema";
import type { Sheet } from "~/characters/types";
import type { CharacterPage } from "~/characters/view";
import { inputClass } from "../styles";
import { NumberField, TextField } from "./Fields";
import type { Parts } from "./SheetSections";

export function subtitle(sheet: Sheet): string {
  const parts = [
    sheet.species,
    sheet.className ? `${sheet.className} ${sheet.level}` : `Level ${sheet.level}`,
    sheet.background,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function HeaderFields({
  page,
  parts,
  text,
}: {
  page: CharacterPage;
  parts: Parts;
  text: (field: TextFieldName) => (value: string) => void;
}) {
  const { sheet, dispatch } = parts;
  return (
    <div className="mt-1 flex flex-wrap items-end gap-2">
      <TextField
        label="Name"
        showLabel
        value={sheet.name}
        placeholder={page.name}
        maxLength={SHORT_TEXT_MAX}
        onCommit={text("name")}
        className="w-40"
      />
      <TextField
        label="Species"
        showLabel
        value={sheet.species}
        maxLength={SHORT_TEXT_MAX}
        onCommit={text("species")}
        className="w-32"
      />
      <TextField
        label="Class"
        showLabel
        value={sheet.className}
        maxLength={SHORT_TEXT_MAX}
        onCommit={text("className")}
        className="w-32"
      />
      <NumberField
        label="Level"
        showLabel
        value={sheet.level}
        min={1}
        max={LEVEL_MAX}
        onCommit={(value) => dispatch({ type: "number", field: "level", value, from: sheet.level })}
      />
      <TextField
        label="Background"
        showLabel
        value={sheet.background}
        maxLength={SHORT_TEXT_MAX}
        onCommit={text("background")}
        className="w-32"
      />
      {page.portraitChoices && (
        <label className="flex flex-col gap-0.5 text-xs text-stone-600 dark:text-stone-400">
          Portrait
          <select
            value={sheet.portrait ?? ""}
            onChange={(event) =>
              dispatch({
                type: "portrait",
                value: event.target.value || undefined,
                from: sheet.portrait,
              })
            }
            className={`${inputClass} max-w-56`}
          >
            <option value="">From the character&rsquo;s note</option>
            {page.portraitChoices.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
