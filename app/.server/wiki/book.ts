import type { Viewer } from "~/campaign/types";
import type { Account } from "~/.server/auth/account";
import type { Vault } from "~/.server/vault/vault";
import type { Campaigns } from "../campaigns/campaigns";

/**
 * The folder that is the tome's book for this viewer, if they read the wiki as a tome and the DM
 * has picked one they have notes in. Everything outside it is left out of the tome: its
 * chapters, spells and counts. Undefined means the whole vault.
 */
export async function bookFolderFor(
  vault: Vault,
  campaigns: Campaigns,
  viewer: Viewer,
  account: Account,
): Promise<string | undefined> {
  if (account.kind !== "member" || account.member.wikiLook !== "tome") return undefined;
  const { folder } = await campaigns.active();
  if (!folder) return undefined;
  // A folder this viewer has nothing in is no book for them, and its name is never sent.
  return vault.folderTree(viewer).folders.some((top) => top.path === folder) ? folder : undefined;
}
