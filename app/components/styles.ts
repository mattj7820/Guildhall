/**
 * Classes shared by module controls (the combat tracker, maps, sheets). Colours are the theme's
 * named ones; the `gh-*` names let each theme's stylesheet dress them (app/app.css).
 */

export const buttonClass =
  "gh-button rounded-md border border-line bg-surface px-2.5 py-1 text-sm font-medium text-ink hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonClass =
  "gh-primary rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50";

export const iconButtonClass =
  "rounded px-1.5 py-0.5 text-sm text-muted hover:bg-raised hover:text-ink disabled:opacity-30";

export const inputClass =
  "gh-field rounded-md border border-line bg-field px-2 py-1 text-sm text-ink placeholder:text-faint";

export const panelClass = "gh-panel rounded-lg border border-line bg-surface p-4 shadow-sm";

export const labelClass = "gh-label text-xs font-semibold tracking-wide text-muted uppercase";
