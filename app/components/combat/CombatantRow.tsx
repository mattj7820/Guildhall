import type { FormEvent } from "react";
import type { EncounterAction } from "~/combat/encounter";
import { isBloodied, isDown } from "~/combat/turns";
import { CONDITIONS, type Combatant, type MonsterCombatant } from "~/combat/types";
import { buttonClass, iconButtonClass, inputClass } from "./styles";

type Dispatch = (action: EncounterAction) => void;

export function CombatantRow({
  combatant,
  isActive,
  isShown,
  isFirst,
  isLast,
  dispatch,
  onShowStatblock,
}: {
  combatant: Combatant;
  isActive: boolean;
  isShown: boolean;
  isFirst: boolean;
  isLast: boolean;
  dispatch: Dispatch;
  onShowStatblock: () => void;
}) {
  const { id, name } = combatant;
  const down = isDown(combatant);

  return (
    <li
      aria-label={name}
      aria-current={isActive ? "step" : undefined}
      className={`flex flex-col gap-2 py-3 pl-3 ${
        isActive
          ? "border-l-4 border-amber-600 bg-amber-50 dark:bg-amber-950/40"
          : "border-l-4 border-transparent"
      } ${down ? "opacity-50" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <InitiativeInput
          key={String(combatant.initiative)}
          name={name}
          value={combatant.initiative}
          onCommit={(initiative) => dispatch({ type: "setInitiative", id, initiative })}
        />
        <div className="mr-auto min-w-0">
          <p className="font-semibold">
            {isActive && <span className="sr-only">Current turn: </span>}
            {name}
            {down && <Badge tone="down">Down</Badge>}
            {isBloodied(combatant) && <Badge tone="bloodied">Bloodied</Badge>}
          </p>
          <p className="text-xs text-stone-500">
            {combatant.kind === "monster"
              ? combatant.armorClass !== undefined
                ? `AC ${combatant.armorClass}`
                : "Monster"
              : `${combatant.entityId ? "PC" : "Companion"} · ${combatant.controller.name}`}
          </p>
        </div>
        {combatant.statblock && (
          <button
            type="button"
            className={iconButtonClass}
            aria-pressed={isShown}
            aria-label={`Show statblock for ${name}`}
            onClick={onShowStatblock}
          >
            📜
          </button>
        )}
        <button
          type="button"
          className={iconButtonClass}
          aria-label={`Move ${name} up`}
          disabled={isFirst}
          onClick={() => dispatch({ type: "move", id, offset: -1 })}
        >
          ↑
        </button>
        <button
          type="button"
          className={iconButtonClass}
          aria-label={`Move ${name} down`}
          disabled={isLast}
          onClick={() => dispatch({ type: "move", id, offset: 1 })}
        >
          ↓
        </button>
        <button
          type="button"
          className={iconButtonClass}
          aria-label={`Remove ${name}`}
          onClick={() => dispatch({ type: "remove", id })}
        >
          ✕
        </button>
      </div>

      {combatant.kind === "monster" && <HpControls monster={combatant} dispatch={dispatch} />}

      <div className="flex flex-wrap items-center gap-2">
        {combatant.conditions.map((condition) => (
          <button
            key={condition}
            type="button"
            aria-label={`Remove ${condition} from ${name}`}
            className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-200"
            onClick={() => dispatch({ type: "toggleCondition", id, condition })}
          >
            {condition} ×
          </button>
        ))}
        <select
          aria-label={`Add condition to ${name}`}
          className={`${inputClass} py-0.5 text-xs`}
          value=""
          onChange={(event) => {
            const condition = CONDITIONS.find((c) => c === event.target.value);
            if (condition) dispatch({ type: "toggleCondition", id, condition });
          }}
        >
          <option value="">+ condition</option>
          {CONDITIONS.filter((c) => !combatant.conditions.includes(c)).map((condition) => (
            <option key={condition} value={condition}>
              {condition}
            </option>
          ))}
        </select>
        <NoteInput
          key={combatant.note}
          name={name}
          value={combatant.note}
          onCommit={(note) => dispatch({ type: "setNote", id, note })}
        />
      </div>
    </li>
  );
}

function Badge({ tone, children }: { tone: "down" | "bloodied"; children: string }) {
  const colours =
    tone === "down"
      ? "bg-stone-700 text-white"
      : "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200";
  return (
    <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${colours}`}>
      {children}
    </span>
  );
}

/** Commits on Enter or when focus leaves. Remounted (by key) when the value changes elsewhere. */
function InitiativeInput({
  name,
  value,
  onCommit,
}: {
  name: string;
  value: number | null;
  onCommit: (value: number | null) => void;
}) {
  function commit(raw: string) {
    const next = raw.trim() === "" ? null : Math.trunc(Number(raw));
    if (next !== value && (next === null || Number.isFinite(next))) onCommit(next);
  }
  return (
    <input
      type="number"
      aria-label={`Initiative for ${name}`}
      defaultValue={value ?? ""}
      placeholder="Init"
      className={`${inputClass} w-16 text-center font-mono text-lg font-bold`}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit(event.currentTarget.value);
      }}
    />
  );
}

function NoteInput({
  name,
  value,
  onCommit,
}: {
  name: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  function commit(raw: string) {
    if (raw.trim() !== value) onCommit(raw.trim());
  }
  return (
    <input
      type="text"
      aria-label={`Note for ${name}`}
      defaultValue={value}
      placeholder="Note"
      maxLength={200}
      className={`${inputClass} min-w-40 flex-1 py-0.5 text-xs`}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit(event.currentTarget.value);
      }}
    />
  );
}

const HP_OPERATIONS = [
  { type: "damage", label: "Damage" },
  { type: "heal", label: "Heal" },
  { type: "gainTempHp", label: "Temp HP" },
  { type: "setMaxHp", label: "Set max" },
] as const;

/** Type an amount, then Damage (also on Enter), Heal, Temp HP or Set max. */
function HpControls({ monster, dispatch }: { monster: MonsterCombatant; dispatch: Dispatch }) {
  const { id, name, hp } = monster;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const operation = HP_OPERATIONS.find((op) => op.type === submitter?.value) ?? HP_OPERATIONS[0];
    const amount = Number(new FormData(form).get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) return;
    dispatch({ type: operation.type, id, amount });
    form.reset();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <p className="w-28 font-mono text-sm">
        HP <strong className="text-base">{hp.current}</strong>/{hp.max}
        {hp.temp > 0 && <span className="text-sky-700 dark:text-sky-400"> +{hp.temp}</span>}
      </p>
      <input
        type="number"
        name="amount"
        min={1}
        aria-label={`Amount for ${name}`}
        placeholder="0"
        className={`${inputClass} w-16`}
      />
      {HP_OPERATIONS.map((op) => (
        <button
          key={op.type}
          type="submit"
          value={op.type}
          aria-label={`${op.label} ${name}`}
          className={`${buttonClass} py-0.5 text-xs`}
        >
          {op.label}
        </button>
      ))}
    </form>
  );
}
