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
    // sharp can write files itself. It may only make buffers, which the file cache writes.
    files: ["app/**/*.{ts,tsx}", "server/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='toFile']",
          message: "The vault is read-only. Make a buffer and write it through the file cache.",
        },
      ],
    },
  },
);
