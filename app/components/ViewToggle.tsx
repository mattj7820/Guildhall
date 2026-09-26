import { Form, useLocation } from "react-router";
import type { Role } from "~/campaign/types";

/** Switches between the DM view and a preview of what players can see. */
export function ViewToggle({ role }: { role: Role }) {
  const location = useLocation();
  const next: Role = role === "dm" ? "player" : "dm";

  return (
    <Form method="post" action="/view-mode" className="flex items-center gap-2 text-sm">
      <span className="text-stone-500 dark:text-stone-400">
        Viewing as{" "}
        <strong className="text-stone-900 dark:text-stone-100">
          {role === "dm" ? "DM" : "Player"}
        </strong>
      </span>
      <input type="hidden" name="role" value={next} />
      <input type="hidden" name="redirectTo" value={location.pathname + location.search} />
      <button
        type="submit"
        className="rounded-md border border-stone-300 px-2.5 py-1 font-medium hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
      >
        {role === "dm" ? "Preview as player" : "Back to DM view"}
      </button>
    </Form>
  );
}
