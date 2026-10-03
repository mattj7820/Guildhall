/** The error codes Windows gives while a file is briefly held by something else. */
const BUSY = new Set(["EPERM", "EBUSY", "EACCES"]);

/**
 * Runs a file operation, trying again for a moment if the file is busy. On Windows a file can't
 * be opened or replaced while it's being replaced or read (by another request, an antivirus or a
 * backup); elsewhere these errors are real, and still come through after the last try.
 */
export async function whenFree<T>(operation: () => Promise<T>, attempts = 5): Promise<T> {
  for (let tries = 1; ; tries++) {
    try {
      return await operation();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (tries >= attempts || !BUSY.has(code ?? "")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * tries));
    }
  }
}
