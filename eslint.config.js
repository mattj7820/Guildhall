import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// fs APIs that could modify the filesystem. The vault is strictly read-only, so
// any server code that touches it may not use these.
const FS_WRITE_APIS = [
  "writeFile",
  "writeFileSync",
  "appendFile",
  "appendFileSync",
  "createWriteStream",
  "rename",
  "renameSync",
  "unlink",
  "unlinkSync",
  "rm",
  "rmSync",
  "rmdir",
  "rmdirSync",
  "mkdir",
  "mkdirSync",
  "copyFile",
  "copyFileSync",
  "cp",
  "cpSync",
  "truncate",
  "truncateSync",
  "chmod",
  "chmodSync",
  "utimes",
  "utimesSync",
  "symlink",
  "symlinkSync",
  "link",
  "linkSync",
  "open",
  "openSync",
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
    files: ["app/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // Read-only guarantee: app and server code may not write to disk. Named imports of write
    // APIs are banned, and so are namespace imports of fs (which would bypass that check).
    // The two exceptions are the JSON store and the file cache (generated files such as map
    // tiles), which write only inside DATA_PATH; config refuses to start if that folder overlaps
    // the vault.
    files: ["app/**/*.{ts,tsx}", "server/**/*.ts"],
    ignores: ["**/*.test.ts", "app/.server/data/json-store.ts", "app/.server/data/file-cache.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["fs", "node:fs", "fs/promises", "node:fs/promises"].map((name) => ({
            name,
            importNames: FS_WRITE_APIS,
            message: "The vault is read-only. Server code must not write to the filesystem.",
          })),
        },
      ],
      "no-restricted-properties": [
        "error",
        ...FS_WRITE_APIS.flatMap((property) =>
          ["fs", "fsp", "fsPromises"].map((object) => ({
            object,
            property,
            message: "The vault is read-only. Server code must not write to the filesystem.",
          })),
        ),
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
