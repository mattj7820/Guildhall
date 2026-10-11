import { useState, type FormEvent } from "react";
import { Link, useFetcher } from "react-router";
import { toPrepared } from "~/combat/prepared";
import { PREPARED_NAME_MAX } from "~/combat/schema";
import type { Encounter, PreparedPlacement } from "~/combat/types";
import type { action } from "~/routes/combat-prepared";
import { buttonClass, inputClass, panelClass } from "~/components/styles";

/**
 * Keeps the monsters and companions of a fight being set up as a prepared encounter; on a map,
 * also the map and where the monsters stand, so it starts there.
 */
export function SaveAsPrepared({
  encounter,
  placement,
}: {
  encounter: Encounter;
  placement?: PreparedPlacement;
}) {
  const fetcher = useFetcher<typeof action>();
  const [name, setName] = useState("");
  const result = fetcher.data;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void fetcher.submit(
      // Round-trip through JSON: submit wants plain JSON values, which is what gets sent anyway.
      JSON.parse(
        JSON.stringify({ intent: "create", name, encounter: toPrepared(encounter), placement }),
      ),
      { method: "post", action: "/combat/prepared", encType: "application/json" },
    );
  }

  return (
    <details className={panelClass}>
      <summary className="cursor-pointer text-sm font-semibold">
        Save as a prepared encounter
      </summary>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm font-medium">
          Prepared encounter name
          <input
            value={name}
            maxLength={PREPARED_NAME_MAX}
            placeholder="Untitled encounter"
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </label>
        <button type="submit" className={buttonClass} disabled={fetcher.state !== "idle"}>
          Save as prepared
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">
        Keeps the monsters (with their HP) and companions
        {placement && ", and where the monsters stand on this map"}. The party and initiative are
        chosen each time it starts.
      </p>
      {result && "created" in result && result.created && (
        <p role="status" className="mt-2 text-sm">
          Saved as “{result.created.name}”.{" "}
          <Link to={`/combat/prepared/${result.created.id}`} className="text-link underline">
            Edit it
          </Link>
        </p>
      )}
      {result && "error" in result && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {result.error}
        </p>
      )}
    </details>
  );
}
