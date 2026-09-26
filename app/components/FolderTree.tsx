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
            <summary className="cursor-pointer rounded px-1.5 py-1 font-medium text-stone-700 select-none hover:bg-stone-200/60 dark:text-stone-300 dark:hover:bg-stone-800">
              {child.name}
            </summary>
            <div className="ml-3 border-l border-stone-200 pl-2 dark:border-stone-800">
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
                isActive
                  ? "bg-amber-100 font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  : "hover:bg-stone-200/60 dark:hover:bg-stone-800"
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
