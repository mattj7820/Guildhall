/**
 * Guildhall's looks. Each person picks their own (saved on their account); someone who hasn't
 * picked gets Storybook on a light device and Iron and Ember on a dark one. Isomorphic.
 */

export const THEMES = ["storybook", "ember", "gem"] as const;
export type Theme = (typeof THEMES)[number];

export interface ThemeInfo {
  label: string;
  description: string;
  dark: boolean;
  /** A few of its colours, for the picker. */
  swatches: string[];
}

export const THEME_INFO: Record<Theme, ThemeInfo> = {
  storybook: {
    label: "Storybook",
    description: "Light and gilded: teal and gold, with a jewel colour for each part of the app.",
    dark: false,
    swatches: ["#f5f2e6", "#1e4a4e", "#d9b450", "#a3366a"],
  },
  ember: {
    label: "Iron and Ember",
    description: "Dark and grim: blackened iron with forge light at the edges.",
    dark: true,
    swatches: ["#0f0e0e", "#1d1a19", "#c4471c", "#ff8a3d"],
  },
  gem: {
    label: "Gemlight",
    description:
      "Dark and luminous: night-blue glass, with a gemstone colour for each part of the app.",
    dark: true,
    swatches: ["#0a1322", "#7cc8ff", "#6fe3a4", "#ff7c8f"],
  },
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}
