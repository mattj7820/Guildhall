---
name: add-monster
description: Add a monster's statblock to the DM's Obsidian vault as a note Guildhall's combat tracker reads, from the bundled SRDs (2014 or 2024), from book text or pictures the DM gives, or as the DM's tweak of one. Use when the user asks to add, copy or tweak a monster, creature or statblock in their vault.
argument-hint: <monster, edition and any tweaks>
---

# Add a monster

What the DM asked for: $ARGUMENTS

First read `docs/vault-authoring.md` and follow its rules. They're the important part: nothing
made up, ask for the edition, tweaks change only what was asked, only add notes, and show and check
before writing.

## Steps

1. **Settle what's wanted:** the monster, the edition (2014 or 2024; ask if not given), any
   tweaks, the new note's name (a tweaked monster usually wants its own name, so it isn't
   confused with the SRD's in the tracker's picker; ask), and whether players may see it (usually
   not).
2. **Get the source:**
   - From the SRD: `node scripts/srd-lookup.ts monster "<name>" --srd <2014|2024>`. If it isn't
     found, it lists the closest names; offer those if they fit.
   - Not in the SRD (most of the Monster Manual isn't): ask the DM to paste the statblock or send a
     picture of the page. Copy it verbatim, flavour text included.
   - An unchanged SRD monster is already in Guildhall's tracker (tagged 2014 or 2024). Say so,
     and add it anyway if the DM still wants it in the vault.
3. **Write the statblock** in the Fantasy Statblocks YAML. The fields Guildhall reads: `name`,
   `size`, `type`, `subtype`, `alignment`, `ac`, `initiative` (2024 only: the bonus, a number),
   `hp`, `hit_dice` (like `6d8 + 12`), `speed`, `stats` (six scores, STR to CHA), `saves` and
   `skillsaves` (lists of `- dexterity: 5`), `damage_vulnerabilities`, `damage_resistances`,
   `damage_immunities`, `condition_immunities`, `gear` (2024), `senses`, `languages`, `cr`,
   `traits`, `actions`, `bonus_actions`, `reactions`, `legendary_actions` (lists of `name` and
   `desc`), `legendary_description`, and `spells`. Keep the book's wording in `desc`, since
   Guildhall finds the rolls in it (`+5 to hit` or `Attack Roll: +5`, `7 (2d6)`,
   `DC 13 Dexterity`). Quote values YAML would misread (anything with `: `, and CRs like `"1/2"`).
   Book text and flavour go above the block, verbatim.
4. **Apply tweaks** as `docs/vault-authoring.md` says: only what was asked, with the knock-on
   numbers listed and asked about.
5. **Draft, check, show, write:** draft in the scratchpad, run
   `node scripts/check-note.ts <draft> monster`, show the DM, and write once they agree. Then
   check the written file.
