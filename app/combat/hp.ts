import type { HitPoints } from "./types";

/** Damage drains temporary HP first, then current HP, stopping at 0. */
export function applyDamage(hp: HitPoints, amount: number): HitPoints {
  const damage = wholeAmount(amount);
  const absorbed = Math.min(hp.temp, damage);
  return {
    ...hp,
    temp: hp.temp - absorbed,
    current: Math.max(0, hp.current - (damage - absorbed)),
  };
}

/** Healing raises current HP up to the maximum; it brings a downed monster back up. */
export function applyHealing(hp: HitPoints, amount: number): HitPoints {
  return { ...hp, current: Math.min(hp.max, hp.current + wholeAmount(amount)) };
}

/** Temporary HP doesn't stack: the higher of the old and new amounts is kept. */
export function gainTempHp(hp: HitPoints, amount: number): HitPoints {
  return { ...hp, temp: Math.max(hp.temp, wholeAmount(amount)) };
}

/**
 * Changes maximum HP (at least 1). Raising it raises current HP by the same amount, so a fresh
 * monster stays at full; lowering it only caps current HP.
 */
export function setMaxHp(hp: HitPoints, max: number): HitPoints {
  const newMax = Math.max(1, wholeAmount(max));
  const current = newMax > hp.max ? hp.current + (newMax - hp.max) : Math.min(hp.current, newMax);
  return { ...hp, max: newMax, current };
}

export function fullHp(max: number): HitPoints {
  const value = Math.max(1, wholeAmount(max));
  return { current: value, max: value, temp: 0 };
}

/** Amounts typed by the DM: whole, non-negative numbers; anything else counts as 0. */
function wholeAmount(amount: number): number {
  return Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
}
