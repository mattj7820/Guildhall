import type { Role } from "~/campaign/types";

/**
 * What the hub home page links to: external tools used at the table, and Guildhall's own modules.
 * A plain list on purpose; modules are added here by hand as they're built.
 */
export interface HubLink {
  id: string;
  title: string;
  description: string;
  /** Undefined when the link needs configuring first. */
  href?: string;
  external: boolean;
  /** Shown instead of a link when `href` is missing. */
  setupHint?: string;
}

export interface HubLinks {
  tools: HubLink[];
  modules: HubLink[];
}

/** DM-only modules are left out of the player preview. */
export function hubLinks(config: { roll20CampaignUrl?: string }, role: Role = "dm"): HubLinks {
  return {
    tools: [
      {
        id: "roll20",
        title: "Roll20",
        description: "Battle maps and tokens for the current campaign.",
        href: config.roll20CampaignUrl,
        external: true,
        setupHint: "Set ROLL20_CAMPAIGN_URL in .env to link your campaign.",
      },
    ],
    modules: [
      {
        id: "wiki",
        title: "Campaign wiki",
        description: "Browse and search the campaign notes.",
        href: "/wiki",
        external: false,
      },
      {
        id: "characters",
        title: "Characters",
        description: "Character sheets and bags: roll from the sheet, and carry your loot.",
        href: "/characters",
        external: false,
      },
      ...(role === "dm"
        ? [
            {
              id: "combat",
              title: "Combat tracker",
              description:
                "Initiative, turns, monster HP and statblocks, with fights prepared ahead. DM only.",
              href: "/combat",
              external: false,
            },
            {
              id: "maps",
              title: "Maps",
              description:
                "Vault maps with clickable areas that lead to deeper maps and wiki notes. DM only.",
              href: "/maps",
              external: false,
            },
            {
              id: "members",
              title: "Members",
              description: "Let your players in, and say which characters they play. DM only.",
              href: "/members",
              external: false,
            },
          ]
        : []),
    ],
  };
}
