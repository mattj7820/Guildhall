// PROTOTYPE (removed before the PR): pretend sheet state for trying the feel of spells, slots,
// limited uses, hit dice and rests. Nothing is saved; the real model will be actions through
// `applyAction`. Kept in a module-level store so moving between the two prototype pages keeps it.
import { useSyncExternalStore } from "react";
import type { Ability } from "~/characters/abilities";
import type { InventoryChange } from "~/characters/inventory-changes";
import { applyInventoryChange, emptyPurse } from "~/characters/inventory-changes";
import type { HitPoints, Inventory } from "~/characters/types";
import { applyDamage, applyHealing } from "~/combat/hp";
import type { SpellShape } from "~/maps/grid/shapes";

export type Reset = "short" | "long" | "manual";

export interface Counter {
  max: number;
  used: number;
}

export interface LimitedUse extends Counter {
  id: string;
  name: string;
  reset: Reset;
}

export interface Attack {
  id: string;
  name: string;
  bonus: number;
  damage: string;
  damageType: string;
  notes?: string;
}

export interface Spell {
  id: string;
  name: string;
  /** 0 for a cantrip. */
  level: number;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  attack: boolean;
  save?: Ability;
  roll?: string;
  effect?: string;
  area?: { shape: SpellShape; feet: number };
  description: string;
  /** A limited use that casts it without a slot. */
  freeUse?: string;
}

export interface ProtoSheet {
  name: string;
  subtitle: string;
  hp: HitPoints;
  armourClass: number;
  initiative: number;
  speed: string;
  passivePerception: number;
  conModifier: number;
  spellAbility: string;
  spellDc: number;
  spellAttack: number;
  /** Index 0 is 1st level. */
  slots: Counter[];
  hitDice: Counter & { die: number };
  uses: LimitedUse[];
  attacks: Attack[];
  spells: Spell[];
  concentrating: string;
  inventory: Inventory;
  saves: { label: string; bonus: number }[];
  skills: { label: string; bonus: number }[];
}

export type CounterRef = { slot: number } | { use: string } | "hitDice";

const initial: ProtoSheet = {
  name: "Prototype Monk",
  subtitle: "Prototype species · Monk 2",
  hp: { current: 9, max: 15, temp: 0 },
  armourClass: 15,
  initiative: 3,
  speed: "40 ft.",
  passivePerception: 13,
  conModifier: 1,
  spellAbility: "WIS",
  spellDc: 13,
  spellAttack: 5,
  slots: [
    { max: 2, used: 1 },
    { max: 1, used: 0 },
    ...Array.from({ length: 7 }, () => ({ max: 0, used: 0 })),
  ],
  hitDice: { die: 8, max: 2, used: 1 },
  uses: [
    { id: "focus", name: "Focus points", max: 2, used: 1, reset: "short" },
    { id: "free-mend", name: "Mend Wounds (free)", max: 1, used: 0, reset: "long" },
    { id: "luck", name: "Lucky break", max: 3, used: 0, reset: "long" },
    { id: "wand", name: "Wand charges", max: 7, used: 2, reset: "manual" },
    { id: "pool", name: "Healing pool", max: 15, used: 4, reset: "long" },
  ],
  attacks: [
    {
      id: "unarmed",
      name: "Unarmed strike",
      bonus: 5,
      damage: "1d6+3",
      damageType: "bludgeoning",
    },
    { id: "staff", name: "Quarterstaff", bonus: 5, damage: "1d8+3", damageType: "bludgeoning" },
    {
      id: "darts",
      name: "Darts",
      bonus: 5,
      damage: "1d4+3",
      damageType: "piercing",
      notes: "20/60 ft.",
    },
  ],
  spells: [
    {
      id: "dart",
      name: "Frost Dart",
      level: 0,
      castingTime: "1 action",
      range: "60 ft.",
      components: "V, S",
      duration: "Instant",
      concentration: false,
      ritual: false,
      attack: true,
      roll: "1d10",
      effect: "cold",
      description: "Prototype text: a ranged spell attack.",
    },
    {
      id: "glimmer",
      name: "Glimmer",
      level: 0,
      castingTime: "1 action",
      range: "Touch",
      components: "V",
      duration: "1 hour",
      concentration: false,
      ritual: false,
      attack: false,
      description: "Prototype text: a utility cantrip with nothing to roll.",
    },
    {
      id: "mend",
      name: "Mend Wounds",
      level: 1,
      castingTime: "Bonus action",
      range: "60 ft.",
      components: "V",
      duration: "Instant",
      concentration: false,
      ritual: false,
      attack: false,
      roll: "2d4+3",
      effect: "healing",
      description: "Prototype text: heals a creature you can see. Free once per long rest.",
      freeUse: "free-mend",
    },
    {
      id: "thorns",
      name: "Ward of Thorns",
      level: 1,
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "1 minute",
      concentration: true,
      ritual: false,
      attack: false,
      save: "dex",
      roll: "2d6",
      effect: "piercing",
      area: { shape: "sphere", feet: 10 },
      description: "Prototype text: a concentration spell with a save and an area.",
    },
    {
      id: "listen",
      name: "Far Listening",
      level: 1,
      castingTime: "1 minute",
      range: "Self",
      components: "V, S",
      duration: "10 minutes",
      concentration: true,
      ritual: true,
      attack: false,
      description: "Prototype text: a ritual, castable without a slot.",
    },
    {
      id: "surge",
      name: "Stone Surge",
      level: 2,
      castingTime: "1 action",
      range: "90 ft.",
      components: "V, S",
      duration: "Instant",
      concentration: false,
      ritual: false,
      attack: false,
      save: "con",
      roll: "3d8",
      effect: "thunder",
      area: { shape: "cube", feet: 15 },
      description: "Prototype text: a 2nd-level spell with a save.",
    },
  ],
  concentrating: "",
  inventory: {
    items: [
      item("rope", "Rope (50 ft.)", "rope"),
      item("torch", "Torch", "torch", 4),
      item("staff-item", "Quarterstaff", "staff", 1, true),
      item("potion", "Potion of healing", "potion", 2),
      item("bread", "Rations", "bread", 5),
    ],
    purse: { ...emptyPurse, gp: 12, sp: 7 },
  },
  saves: [
    { label: "STR save", bonus: 3 },
    { label: "DEX save", bonus: 5 },
    { label: "CON save", bonus: 1 },
    { label: "INT save", bonus: 0 },
    { label: "WIS save", bonus: 3 },
    { label: "CHA save", bonus: -1 },
  ],
  skills: [
    { label: "Acrobatics", bonus: 5 },
    { label: "Athletics", bonus: 5 },
    { label: "Insight", bonus: 3 },
    { label: "Perception", bonus: 3 },
    { label: "Stealth", bonus: 3 },
  ],
};

function item(id: string, name: string, icon: string, quantity = 1, equipped = false) {
  return { id, name, icon: { builtin: icon }, quantity, equipped, attuned: false };
}

/* A tiny store with undo, standing in for the editor. */

let state = initial;
let history: ProtoSheet[] = [];
const listeners = new Set<() => void>();

function set(next: ProtoSheet) {
  history = [...history, state].slice(-50);
  state = next;
  listeners.forEach((listener) => listener());
}

export function useProtoSheet() {
  const sheet = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
  return { sheet, ...protoActions, canUndo: history.length > 0 };
}

export const protoActions = {
  undo() {
    const previous = history.at(-1);
    if (!previous) return;
    history = history.slice(0, -1);
    state = previous;
    listeners.forEach((listener) => listener());
  },
  count(counter: CounterRef, by: number) {
    set(withCounter(state, counter, by));
  },
  damage(amount: number) {
    set({ ...state, hp: applyDamage(state.hp, amount) });
  },
  heal(amount: number) {
    set({ ...state, hp: applyHealing(state.hp, amount) });
  },
  setHp(field: keyof HitPoints, value: number) {
    set({ ...state, hp: { ...state.hp, [field]: value } });
  },
  /** Returns the concentration it replaced, if any. */
  cast(spell: Spell, how: { slot: number } | { use: string } | "ritual"): string | undefined {
    let next = how === "ritual" ? state : withCounter(state, how, 1);
    const replaced =
      spell.concentration && state.concentrating && state.concentrating !== spell.name
        ? state.concentrating
        : undefined;
    if (spell.concentration) next = { ...next, concentrating: spell.name };
    set(next);
    return replaced;
  },
  dropConcentration() {
    set({ ...state, concentrating: "" });
  },
  shortRest(faces: number[]) {
    const healing = faces.reduce((sum, face) => sum + hitDieHealing(face, state.conModifier), 0);
    set({
      ...state,
      hp: applyHealing(state.hp, healing),
      hitDice: {
        ...state.hitDice,
        used: Math.min(state.hitDice.max, state.hitDice.used + faces.length),
      },
      uses: state.uses.map((use) => (use.reset === "short" ? { ...use, used: 0 } : use)),
    });
  },
  longRest() {
    set({
      ...state,
      hp: { ...state.hp, current: state.hp.max, temp: 0 },
      hitDice: { ...state.hitDice, used: 0 },
      slots: state.slots.map((slot) => ({ ...slot, used: 0 })),
      uses: state.uses.map((use) => (use.reset === "manual" ? use : { ...use, used: 0 })),
      concentrating: "",
    });
  },
  inventory(change: InventoryChange) {
    set({ ...state, inventory: applyInventoryChange(state.inventory, change) });
  },
};

/** A spent hit die heals its roll plus CON, at least 1. */
export function hitDieHealing(face: number, conModifier: number): number {
  return Math.max(1, face + conModifier);
}

/** What a long rest would give back, said in words for its toast. */
export function longRestSummary(sheet: ProtoSheet): string {
  const parts: string[] = [];
  if (sheet.hp.current < sheet.hp.max) parts.push(`HP ${sheet.hp.max}/${sheet.hp.max}`);
  if (sheet.hitDice.used > 0) parts.push(`${sheet.hitDice.used} hit dice`);
  const slots = sheet.slots.reduce((sum, slot) => sum + slot.used, 0);
  if (slots > 0) parts.push(`${slots} slot${slots === 1 ? "" : "s"}`);
  for (const use of sheet.uses) {
    if (use.reset !== "manual" && use.used > 0) parts.push(use.name);
  }
  if (sheet.concentrating) parts.push(`ends ${sheet.concentrating}`);
  return parts.length > 0 ? parts.join(", ") : "nothing to restore";
}

function withCounter(sheet: ProtoSheet, counter: CounterRef, by: number): ProtoSheet {
  const step = <T extends Counter>(each: T): T => ({
    ...each,
    used: Math.min(each.max, Math.max(0, each.used + by)),
  });
  if (counter === "hitDice") return { ...sheet, hitDice: step(sheet.hitDice) };
  if ("slot" in counter) {
    return {
      ...sheet,
      slots: sheet.slots.map((slot, index) => (index === counter.slot - 1 ? step(slot) : slot)),
    };
  }
  return {
    ...sheet,
    uses: sheet.uses.map((use) => (use.id === counter.use ? step(use) : use)),
  };
}

export const ORDINALS = ["Cantrips", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
