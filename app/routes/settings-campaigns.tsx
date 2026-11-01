import { data, Form, Link } from "react-router";
import { z } from "zod";
import { openCampaignData } from "~/.server/campaigns/campaign-data";
import { leftOutOf } from "~/.server/campaigns/left-out";
import { runCampaign } from "~/.server/campaigns/run";
import { requireDm } from "~/.server/not-found";
import { topFolders } from "~/.server/vault/read-vault";
import { Vault } from "~/.server/vault/vault";
import { buttonClass, inputClass, panelClass, primaryButtonClass } from "~/components/styles";
import { servicesContext, viewerContext } from "~/context";
import { CAMPAIGN_NAME_MAX, FIRST_CAMPAIGN, type Campaign } from "~/campaign/campaigns";
import type { Route } from "./+types/settings-campaigns";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Campaigns · Guildhall" }];
}

/**
 * The DM's campaigns: each a folder of the vault with Guildhall's own data about it. One runs at
 * a time, and the whole app is that campaign; players never see the others.
 */
export async function loader({ context }: Route.LoaderArgs) {
  requireDm(context.get(viewerContext));
  const { campaigns, config } = context.get(servicesContext);
  return {
    campaigns: await campaigns.list(),
    running: (await campaigns.active()).id,
    folders: await topFolders(config.vaultPath),
  };
}

const formSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("add"), name: z.string().max(200), folder: z.string().min(1) }),
  z.object({ intent: z.literal("rename"), id: z.string().max(40), name: z.string().max(200) }),
  // Checking comes first: what running the campaign in that folder would leave out.
  z.object({ intent: z.literal("check"), id: z.string().max(40), folder: z.string() }),
  z.object({ intent: z.literal("run"), id: z.string().max(40), folder: z.string() }),
]);

export async function action({ request, context }: Route.ActionArgs) {
  requireDm(context.get(viewerContext));
  const services = context.get(servicesContext);
  const { campaigns, config } = services;
  const parsed = formSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return data({ error: "That couldn't be read." }, 400);
  const form = parsed.data;

  if (form.intent === "rename") {
    return (await campaigns.rename(form.id, form.name))
      ? data({ error: "There's no such campaign." }, 404)
      : { ok: true };
  }
  // Only one of the vault's top folders can be a campaign, or (the first) the whole vault.
  const folders = await topFolders(config.vaultPath);
  const folderOk = folders.includes(form.folder) || (!form.folder && form.intent !== "add");
  if (!folderOk) return data({ error: "That isn't one of the vault's folders." }, 400);

  if (form.intent === "add") {
    const added = await campaigns.add(form.name, form.folder);
    return added === "folder-taken" ? data({ error: TAKEN }, 400) : { ok: true };
  }
  const campaign = (await campaigns.list()).find((each) => each.id === form.id);
  if (!campaign) return data({ error: "There's no such campaign." }, 404);
  if (form.intent === "check") {
    const vault = await Vault.load(config.vaultPath);
    const leftOut = await leftOutOf(
      openCampaignData(config.dataPath, campaign),
      vault,
      form.folder || undefined,
    );
    return { check: { id: campaign.id, folder: form.folder, leftOut } };
  }
  if ((campaign.folder ?? "") !== form.folder) {
    const problem = await campaigns.setFolder(campaign.id, form.folder);
    if (problem) return data({ error: problem === "folder-taken" ? TAKEN : "That can't be." }, 400);
  }
  await campaigns.activate(campaign.id);
  await runCampaign(services, await campaigns.active());
  return { ok: true };
}

const TAKEN = "Another campaign is in that folder.";

type Check = { id: string; folder: string; leftOut: string[] };

export default function SettingsCampaigns({ loaderData, actionData }: Route.ComponentProps) {
  const { campaigns, running, folders } = loaderData;
  const check = actionData && "check" in actionData ? actionData.check : undefined;
  const taken = new Set(campaigns.flatMap((campaign) => campaign.folder ?? []));
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <Link to="/settings" className="text-link text-sm">
          ← Settings
        </Link>
        <h1 className="font-display text-title text-4xl">Campaigns</h1>
        <p className="text-muted mt-1">
          Each campaign is a folder of the vault. Guildhall runs one at a time: everything outside
          its folder is left out, and its maps, tokens, fight, sheets and next session are its own.
          The others wait as they were. Players only ever see the one that&apos;s running.
        </p>
      </div>
      {actionData && "error" in actionData && (
        <p role="alert" className="bg-danger-surface text-danger rounded-md px-3 py-2 text-sm">
          {actionData.error}
        </p>
      )}
      <ul className="flex flex-col gap-4">
        {campaigns.map((campaign) => (
          <li key={campaign.id}>
            <CampaignPanel
              campaign={campaign}
              running={campaign.id === running}
              folders={folders.filter((folder) => folder === campaign.folder || !taken.has(folder))}
              check={check?.id === campaign.id ? check : undefined}
            />
          </li>
        ))}
      </ul>
      {/* Keyed by the count, so the form is empty again once a campaign is added. */}
      <AddCampaign
        key={campaigns.length}
        folders={folders.filter((folder) => !taken.has(folder))}
      />
    </main>
  );
}

function CampaignPanel({
  campaign,
  running,
  folders,
  check,
}: {
  campaign: Campaign;
  running: boolean;
  folders: string[];
  check?: Check;
}) {
  const title = campaign.name ?? "Unnamed campaign";
  return (
    <section aria-label={title} className={`${panelClass} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-title text-xl font-semibold">{title}</h2>
        {running && (
          <span className="bg-accent text-on-accent rounded-full px-2 py-0.5 text-xs font-semibold">
            Running
          </span>
        )}
        <span className="text-muted text-sm">
          {campaign.folder ? `The ${campaign.folder} folder` : "The whole vault"}
        </span>
      </div>
      <Form method="post" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="intent" value="rename" />
        <input type="hidden" name="id" value={campaign.id} />
        <label className="sr-only" htmlFor={`name-${campaign.id}`}>
          {title}&apos;s name
        </label>
        <input
          id={`name-${campaign.id}`}
          name="name"
          defaultValue={campaign.name}
          maxLength={CAMPAIGN_NAME_MAX}
          placeholder="The campaign's name"
          className={inputClass}
        />
        <button type="submit" className={buttonClass}>
          Rename
        </button>
      </Form>
      {check ? (
        <CheckResult campaign={campaign} running={running} check={check} />
      ) : (
        <Form method="post" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="intent" value="check" />
          <input type="hidden" name="id" value={campaign.id} />
          <label className="text-sm" htmlFor={`folder-${campaign.id}`}>
            Folder
          </label>
          <select
            id={`folder-${campaign.id}`}
            name="folder"
            defaultValue={campaign.folder ?? ""}
            className={inputClass}
          >
            {campaign.id === FIRST_CAMPAIGN && <option value="">The whole vault</option>}
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>
          <button type="submit" className={running ? buttonClass : primaryButtonClass}>
            {running ? "Change folder…" : "Run this campaign…"}
          </button>
        </Form>
      )}
    </section>
  );
}

/** What running the campaign in that folder would leave out, and the go-ahead. */
function CheckResult({
  campaign,
  running,
  check,
}: {
  campaign: Campaign;
  running: boolean;
  check: Check;
}) {
  const where = check.folder ? `the ${check.folder} folder` : "the whole vault";
  return (
    <div role="status" className="flex flex-col gap-2">
      {check.leftOut.length === 0 ? (
        <p>Nothing this campaign keeps points outside {where}.</p>
      ) : (
        <>
          <p>
            In {where}, this campaign would lose sight of these, as they&apos;re kept outside it.
            Nothing is deleted: they come back if the folder changes back.
          </p>
          <ul className="text-muted list-disc pl-5 text-sm">
            {check.leftOut.map((what) => (
              <li key={what}>{what}</li>
            ))}
          </ul>
        </>
      )}
      <p className="text-muted text-sm">
        Everyone&apos;s open maps and the front page will reload.
      </p>
      <Form method="post" className="flex gap-2">
        <input type="hidden" name="intent" value="run" />
        <input type="hidden" name="id" value={campaign.id} />
        <input type="hidden" name="folder" value={check.folder} />
        <button type="submit" className={primaryButtonClass}>
          {running ? `Run it in ${where}` : `Run ${campaign.name ?? "this campaign"}`}
        </button>
        <Link to="." className={buttonClass}>
          Cancel
        </Link>
      </Form>
    </div>
  );
}

function AddCampaign({ folders }: { folders: string[] }) {
  return (
    <section aria-labelledby="add-campaign" className="flex flex-col gap-2">
      <h2 id="add-campaign" className="font-display text-title text-2xl">
        Add a campaign
      </h2>
      {folders.length === 0 ? (
        <p className="text-muted">Every top folder of the vault is a campaign already.</p>
      ) : (
        <Form method="post" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="intent" value="add" />
          <label className="sr-only" htmlFor="new-campaign-name">
            The new campaign&apos;s name
          </label>
          <input
            id="new-campaign-name"
            name="name"
            maxLength={CAMPAIGN_NAME_MAX}
            placeholder="The campaign's name"
            className={inputClass}
          />
          <label className="text-sm" htmlFor="new-campaign-folder">
            Folder
          </label>
          <select id="new-campaign-folder" name="folder" className={inputClass}>
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClass}>
            Add
          </button>
        </Form>
      )}
      <p className="text-muted text-sm">
        A new campaign starts empty: no maps, sheets or fight. It waits until you run it.
      </p>
    </section>
  );
}
