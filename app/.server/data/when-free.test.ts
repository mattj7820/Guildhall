import { describe, expect, it } from "vitest";
import { whenFree } from "./when-free";

const failure = (code: string) => Object.assign(new Error(code), { code });

/** An operation that fails with these codes first, then answers "done". */
function failing(...codes: string[]) {
  let calls = 0;
  const operation = async () => {
    const code = codes[calls++];
    if (code) throw failure(code);
    return "done";
  };
  return { operation, calls: () => calls };
}

describe("whenFree", () => {
  it.each(["EPERM", "EBUSY", "EACCES"])("tries again while the file is busy (%s)", async (code) => {
    const { operation, calls } = failing(code, code);
    await expect(whenFree(operation)).resolves.toBe("done");
    expect(calls()).toBe(3);
  });

  it("gives up after the last try, with the file's own error", async () => {
    const { operation, calls } = failing("EBUSY", "EBUSY", "EBUSY");
    await expect(whenFree(operation, 3)).rejects.toMatchObject({ code: "EBUSY" });
    expect(calls()).toBe(3);
  });

  it("doesn't wait on other errors, such as a missing file", async () => {
    const { operation, calls } = failing("ENOENT");
    await expect(whenFree(operation)).rejects.toMatchObject({ code: "ENOENT" });
    expect(calls()).toBe(1);
  });
});
