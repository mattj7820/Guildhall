import { runnerImport } from "vite";

/**
 * One of the app's modules, for a script. They use the app's path aliases, which Node can't
 * resolve, so they're loaded through Vite. The script says what it expects the module to export.
 */
export async function appModule<T>(path: string): Promise<T> {
  const { module } = await runnerImport<T>(path, {
    configFile: false,
    logLevel: "silent",
    resolve: { tsconfigPaths: true },
  });
  return module;
}
