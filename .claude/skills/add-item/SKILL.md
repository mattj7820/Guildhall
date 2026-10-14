---
name: add-item
description: Add a magic item or piece of equipment to the DM's Obsidian vault as a type item note that bags on Guildhall's character sheets can link to, from book text or pictures the DM gives, or as the DM's tweak of one. Use when the user asks to add, copy or tweak an item in their vault.
argument-hint: <item, edition and any tweaks>
---

# Add an item

What the DM asked for: $ARGUMENTS

First read `docs/vault-authoring.md` and follow its rules. They're the important part: nothing
made up, ask for the edition, tweaks change only what was asked, only add notes, and show and check
before writing.

## Steps

1. **Settle what's wanted:** the item, the edition (2014 or 2024; ask if not given), any tweaks,
   the note's name, and whether players may see it. Bags link to item notes, and players read
   only the ones they may see. An unidentified or cursed item may want to stay DM-only, or have
   its secrets in a DM part (a `## DM` section or a `> [!dm]` callout) that players never get.
   Ask.
2. **Get the source.** Guildhall bundles no SRD items, so ask the DM to paste the item's text or
   send a picture of the page, and copy it verbatim. For an item of the DM's own making, they give
   every detail; you only lay it out.
3. **Write the note:** frontmatter `type: item` and `visibility`, then the book's layout: the
   item's kind, rarity and attunement in italics (`*Wondrous item, rare (requires attunement)*`),
   then its text, verbatim.
4. **Apply tweaks** as `docs/vault-authoring.md` says.
5. **Draft, check, show, write:** draft in the scratchpad, run
   `node scripts/check-note.ts <draft> item`, show the DM, and write once they agree. Then check
   the written file.
