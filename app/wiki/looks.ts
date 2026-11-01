/**
 * How the wiki is laid out for someone: plain pages (the default) or an open tome. Each person
 * picks their own in Settings, saved on their account. Isomorphic.
 */

export const WIKI_LOOKS = ["pages", "tome"] as const;
export type WikiLook = (typeof WIKI_LOOKS)[number];

export const WIKI_LOOK_INFO: Record<WikiLook, { label: string; description: string }> = {
  pages: {
    label: "Pages",
    description: "Folders down the side, the note beside them, and a search box.",
  },
  tome: {
    label: "Tome",
    description:
      "An open book: folders as ribbons, searching as spells on the left page, the note on the right.",
  },
};
