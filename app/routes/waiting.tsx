import { Form } from "react-router";
import { buttonClass, panelClass } from "~/components/styles";
import { accountContext } from "~/context";
import type { Route } from "./+types/waiting";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Waiting for the DM · Guildhall" }];
}

/** Where someone signed in but not yet let in waits. The middleware keeps everyone else away. */
export function loader({ context }: Route.LoaderArgs) {
  const account = context.get(accountContext);
  return { name: account.kind === "waiting" ? account.member.name : "" };
}

export default function Waiting({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <section className={`${panelClass} flex flex-col gap-3`}>
        <h1 className="font-display text-title text-3xl">Waiting for the DM</h1>
        <p>
          Hi {loaderData.name}. You're signed in, but the DM needs to let you in before you can see
          the campaign. Once they have, reload this page.
        </p>
        <Form method="post" action="/logout">
          <button type="submit" className={buttonClass}>
            Sign out
          </button>
        </Form>
      </section>
    </main>
  );
}
