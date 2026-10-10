import type { Role } from "~/campaign/types";

/**
 * What the hub home page links to: Guildhall's own modules. A plain list on purpose; modules are
 * added here by hand as they're built.
 */
export interface HubLink {
  id: string;
  title: string;
  description: string;
  href: string;
}

/** DM-only modules are left out of the player preview. */
export function hubLinks(role: Role = "dm"): HubLink[] {
  return [
    {
      id: "wiki",
      title: "Campaign wiki",
      description: "Browse and search the campaign notes.",
      href: "/wiki",
    },
    {
      id: "characters",
      title: "Characters",
      description: "Character sheets and bags: roll from the sheet, and carry your loot.",
      href: "/characters",
    },
    {
      id: "maps",
      title: "Maps",
      description:
        role === "dm"
          ? "Vault maps with clickable areas that lead to deeper maps and wiki notes, and fog of war to reveal as the party explores."
          : "The maps you've explored so far, opening up as the party goes.",
      href: "/maps",
    },
    ...(role === "dm"
      ? [
          {
            id: "combat",
            title: "Combat tracker",
            description:
              "Initiative, turns, monster HP and statblocks, with fights prepared ahead. DM only.",
            href: "/combat",
          },
          {
            id: "members",
            title: "Members",
            description: "Let your players in, and say which characters they play. DM only.",
            href: "/members",
          },
        ]
      : []),
  ];
}
