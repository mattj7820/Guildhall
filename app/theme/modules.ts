/** Which part of the app a page belongs to, for its colour (`data-module` on <body>). */
export type Module = "hub" | "wiki" | "characters" | "maps" | "combat";

const MODULES: Module[] = ["wiki", "characters", "maps", "combat"];

export function moduleOf(pathname: string): Module {
  const first = pathname.split("/")[1] ?? "";
  return MODULES.find((module) => module === first) ?? "hub";
}
