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

export function hubLinks(config: { roll20CampaignUrl?: string }): HubLinks {
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
    ],
  };
}
