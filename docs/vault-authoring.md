# Adding to the vault

Three Claude skills add notes to the DM's own vault on request: `/add-monster`, `/add-spell` and
`/add-item` (in `.claude/skills/`). They're how statblocks, spells and items from the books, or
the DM's tweaks of them, get into the vault in the shapes Guildhall reads. This page is the rules
all three follow; each skill adds what's particular to its kind.

Guildhall itself never writes to the vault. These skills are Claude writing into it, on the
DM's request, through the same files the DM edits in Obsidian.

## Rules

1. **Nothing made up.** Every word in a note comes from one of these places:
   - **The bundled SRDs.** `node scripts/srd-lookup.ts <monster|spell> "<name>" [--srd 2014|2024]`
     prints one as a note (statblock, frontmatter and text, word for word from the data).
   - **What the DM gives you:** pasted text, a screenshot or photo of the page, or the details of
     their own creation or tweak. Copy book text **verbatim**, flavour text included.
   - **The DM's tweaks,** written in the book's usual wording, with only the numbers they gave.

   Never fill anything in from memory. That includes non-SRD books, "what the book probably says",
   and flavour or lore of any kind. If it isn't in the SRD data, ask the DM to paste it or send a
   picture of the page. If a tweak needs a number or a choice they didn't give, ask for it.

2. **Ask for the edition.** If the DM didn't say 2014 or 2024, ask, and say which SRDs have the
   thing (the lookup lists both when both have it). The 2014 and 2024 versions differ, so never
   pick one.

3. **Tweaks change only what was asked.** When a change implies others (a higher STR changes
   attack and damage bonuses; CON changes hit points; a new CR changes XP and the proficiency
   bonus), list the knock-on numbers and ask whether to change them too. Don't quietly change them,
   and don't quietly leave them inconsistent.

4. **Only add notes.** Never overwrite, edit, move, rename or delete an existing vault note unless
   the DM asks for exactly that, and confirm first. If the file name is taken, ask for another
   name.

5. **Show it, check it, then write it.** Draft the note in the scratchpad and run
   `node scripts/check-note.ts <draft> <monster|spell|item>`. Fix anything it reports (problems
   are things Guildhall would drop or refuse). Then show the DM the note (or, for an SRD copy with
   tweaks, the tweaks) and where it will go, and write it once they agree. Run the check on the
   written file and report where it is.

## Where the vault is

The vault's path is `VAULT_PATH` in the gitignored `.env`. Read only that line (the file holds
secrets). If it points at `tests/fixtures/vault`, stop: that's the test vault, and the DM's real
one is needed. Ask for its path.

The vault is the DM's real campaign, so keep the repo shareable: nothing from it goes into the
repo, docs or tests.

## Fitting in

Before writing, look at a few existing notes of the same kind in the vault and match them: the
folder they're in, whether they start with an `# H1`, their frontmatter (for example, which `type`
statblock notes use) and their tags. If there are none to follow, ask where it should go.

Visibility: notes are DM-only unless they say `visibility: players`. Ask when it isn't obvious:
players' spells and items they hold usually want `players`; monsters usually stay DM-only.

Formats: statblocks are the Fantasy Statblocks plugin's YAML in a ` ```statblock ` block (see the
README's "Combat tracker"); spell frontmatter is the README's "Spell notes"; item notes are
`type: item` with their text in the body.
