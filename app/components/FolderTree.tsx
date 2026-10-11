import { NavLink } from "react-router";
import type { FolderNode } from "~/wiki/types";
import { noteUrl } from "~/wiki/urls";
import { TypeBadge } from "./TypeBadge";

/** Sidebar navigation mirroring the vault's folders. */
export function FolderTree({ root }: { root: FolderNode }) {
  return (
    <nav aria-label="Wiki folders" className="text-sm">
      <FolderContents folder={root} />
    </nav>
  );
}

function FolderContents({ folder }: { folder: FolderNode }) {
  return (
    <ul className="space-y-0.5">
      {folder.folders.map((child) => (
        <li key={child.path}>
          <details open>
            <summary className="cursor-pointer rounded px-1.5 py-1 font-medium text-ink select-none hover:bg-line/60">
              {child.name}
            </summary>
            <div className="ml-3 border-l border-line pl-2">
              <FolderContents folder={child} />
            </div>
          </details>
        </li>
      ))}
      {folder.notes.map((note) => (
        <li key={note.slug}>
          <NavLink
            to={noteUrl(note.slug)}
            className={({ isActive }) =>
              `flex items-center justify-between gap-2 rounded px-1.5 py-1 ${
                isActive ? "bg-accent-surface font-medium text-title" : "hover:bg-line/60"
              }`
            }
          >
            <span className="truncate">{note.title}</span>
            {note.type && <TypeBadge type={note.type} />}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
