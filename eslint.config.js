import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// The fs APIs app and server code may import: reading only. Anything else from fs (a write, or a
// default or namespace import, through which anything could be reached) is refused.
const FS_READ_APIS = [
  "access",
  "accessSync",
  "constants",
  "createReadStream",
  "existsSync",
  "lstat",
  "lstatSync",
  "readdir",
  "readdirSync",
  "readFile",
  "readFileSync",
  "realpath",
  "realpathSync",
  "stat",
  "statSync",
];

// sharp can write files itself. It may only make buffers, which the file cache writes.
const NO_SHARP_FILES = {
  selector: "CallExpression[callee.property.name='toFile']",
  message: "The vault is read-only. Make a buffer and write it through the file cache.",
};

// Raw Tailwind palette colours (bg-stone-100, dark:text-amber-400, …) look right in one theme
// only. Components use the themes' named colours (app/app.css) instead.
const PALETTE_CLASS = String.raw`/(^|[\s:])(bg|text|border|border-[trblxy]|ring|ring-offset|divide|outline|decoration|shadow|fill|stroke|from|via|to|accent|caret|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]/`;
const NO_PALETTE_CLASSES = ["Literal", "TemplateElement"].map((node) => ({
  selector: `${node}[value${node === "TemplateElement" ? ".raw" : ""}=${PALETTE_CLASS}]`,
  message:
    "Use the theme's named colours (text-ink, bg-surface, border-line, …; see app/app.css), not raw palette classes.",
}));

// Content drawn over map art keeps the same colours in every theme: fog, grids, outlines, tokens,
// measuring, spell areas and stunts, and the pins on the Maps page's previews.
const CONTENT_COLOUR_FILES = [
  "app/components/home/FrontPagePrototype.tsx",
  "app/components/maps/AreaShape.tsx",
  "app/components/maps/DraftOutline.tsx",
  "app/components/maps/FogPainter.tsx",
  "app/components/maps/GridLayer.tsx",
  "app/components/maps/InsideBadges.tsx",
  "app/components/maps/MapsBrowser.tsx",
  "app/components/maps/MeasureLayer.tsx",
  "app/components/maps/SpellAreaLayer.tsx",
  "app/components/maps/Stunts.tsx",
  "app/components/maps/TokenLayer.tsx",
  "app/components/maps/TokenThumb.tsx",
  "app/components/maps/useTokenPick.tsx",
  "app/components/maps/VertexHandles.tsx",
];

export default tseslint.config(
  {
    ignores: ["build/", ".react-router/", "playwright-report/", "test-results/", ".agents/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // Read-only guarantee: app and server code may only import fs's reading APIs. The two
    // exceptions are the JSON store and the file cache (generated files such as map tiles), which
    // write only inside DATA_PATH; config refuses to start if that folder overlaps the vault.
    files: ["app/**/*.{ts,tsx}", "server/**/*.ts", "server.js"],
    ignores: ["**/*.test.ts", "app/.server/data/json-store.ts", "app/.server/data/file-cache.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["fs", "node:fs", "fs/promises", "node:fs/promises"].map((name) => ({
            name,
            allowImportNames: FS_READ_APIS,
            message: "The vault is read-only. Server code may only read from the filesystem.",
          })),
        },
      ],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "server/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: { "no-restricted-syntax": ["error", NO_SHARP_FILES] },
  },
  {
    // One rule setting replaces another, so this repeats the sharp rule for app code.
    files: ["app/**/*.{ts,tsx}"],
    ignores: ["**/*.test.ts", ...CONTENT_COLOUR_FILES],
    rules: { "no-restricted-syntax": ["error", NO_SHARP_FILES, ...NO_PALETTE_CLASSES] },
  },
);
