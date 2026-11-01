import type { Viewer } from "~/campaign/types";
import type { Account } from "~/.server/auth/account";
import type { LiveVault } from "~/.server/vault/live-vault";

/**
 * The folder that is the tome's book for this viewer, if they read the wiki as a tome: the
 * running campaign's folder, whose folders are the chapters. Undefined means the whole vault,
 * as for a campaign without a folder or someone with no notes in it.
 */
export function bookFolderFor(
  vault: LiveVault,
  viewer: Viewer,
  account: Account,
): string | undefined {
  if (account.kind !== "member" || account.member.wikiLook !== "tome") return undefined;
  const { folder } = vault;
  if (!folder) return undefined;
  // A folder this viewer has nothing in is no book for them, and its name is never sent.
  return vault.current.folderTree(viewer).folders.some((top) => top.path === folder)
    ? folder
    : undefined;
}
