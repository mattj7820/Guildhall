/** Wiki shapes sent from the server to the browser. Isomorphic: no server imports. */

export interface NoteSummary {
  id: string;
  slug: string;
  title: string;
  type?: string;
}

export interface FolderNode {
  name: string;
  /** Vault path of the folder; `` for the root. */
  path: string;
  folders: FolderNode[];
  notes: NoteSummary[];
}
