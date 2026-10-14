---
name: add-spell
description: Add a spell to the DM's Obsidian vault as a type spell note that Guildhall's spell picker fills a sheet in from, copied from the bundled SRDs (2014 or 2024), from book text or pictures the DM gives, or as the DM's tweak of one. Use when the user asks to add, copy or tweak a spell in their vault.
argument-hint: <spell, edition and any tweaks>
---

# Add a spell

What the DM asked for: $ARGUMENTS

First read `docs/vault-authoring.md` and follow its rules. They're the important part: nothing
made up, ask for the edition, tweaks change only what was asked, only add notes, and show and check
before writing.

## Steps

1. **Settle what's wanted:** the spell, the edition (2014 or 2024; ask if not given), any tweaks,
   the note's name, and whether players may see it. Players can only pick spell notes they may
   read, so a spell for a player's sheet needs `visibility: players`. Ask.
2. **Get the source:**
   - From the SRD: `node scripts/srd-lookup.ts spell "<name>" --srd <2014|2024>`. That prints the
     frontmatter and text ready to use. If it isn't found, it lists the closest names.
   - Not in the SRD: ask the DM to paste the spell or send a picture of the page, and copy it
     verbatim.
   - An unchanged SRD spell is already in the sheet's spell picker. Say so, and add it anyway if
     the DM still wants it in the vault.
3. **Write the note:** frontmatter as the README's "Spell notes" (`type: spell`, `visibility`,
   `level`, `school`, `classes`, `casting_time`, `range`, `components`, `duration`,
   `concentration`, `ritual`, and where the spell has them `attack`, `save`, `roll`, `effect`,
   `area`), then the spell's text verbatim. Give the material and higher levels in bold as the
   book does (`**At Higher Levels.**` in 2014, `**Using a Higher-Level Spell Slot.**` in 2024).
   Leave out a field the source doesn't give, rather than guessing it.
4. **Apply tweaks** as `docs/vault-authoring.md` says. Keep the frontmatter and the text in step:
   a changed damage die changes `roll` and the sentence that gives it.
5. **Draft, check, show, write:** draft in the scratchpad, run
   `node scripts/check-note.ts <draft> spell` (it says what the picker will fill in), show the DM,
   and write once they agree. Then check the written file.
