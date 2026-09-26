# Roadmap

A loose, unprioritised parking lot of modules, drawn from the original project brain dump. None of
it is committed or scheduled. Everything should link through the shared campaign model (NPCs,
locations, maps, characters, sessions).

## Built

- **Hub shell:** a home page linking to table tools (Roll20) and to Guildhall's own modules.
- **Campaign wiki (read-only):** browse and search the Obsidian vault, with DM/player preview.
- **Combat tracker (first slice, DM only):** encounters built from vault statblocks and PC notes,
  initiative with reroll tie-breaks, turns and rounds, monster HP and conditions, the statblock
  alongside, a dice roller and undo. The encounter is kept in the browser.

## Parking lot

- **Roles and multiplayer:** real DM and player accounts replacing the preview toggle; the DM has
  higher permissions (hidden rolls, moving monster tokens, seeing all notes).
- **Wiki, next steps:** backlinks, note transclusion (`![[Note]]`), Obsidian callouts,
  section-level visibility, browsing by entity type, and perhaps Obsidian plugins later.
- **Character sheets:** create a character in-app (D&D Beyond style), view the sheet, and click
  stats to roll.
- **Dice:** shared dice rolling, including DM hidden rolls. Complements physical dice on camera.
- **Combat tracker, next steps:**
  - **Prepared encounters:** build several encounters before a session, list them, and start one
    at the table. (The DM wants this soon.)
  - **Click-to-roll** from statblock actions (`+4 to hit`, `5 (1d6 + 2)`) into the dice roller.
  - **Player view:** the turn order for everyone, with details only for your own PC and
    companions. The model and filter exist (`encounterForViewer`); this needs real player
    identities and a server-held, shared encounter (websockets on the same Express server).
  - Hidden combatants (ambushers), condition durations, a tablet layout.
  - Later: an overlay on the battle map, with flashy turn transitions and, one day, attack
    animations.
- **Interactive maps:** upload maps and link them together. Click a point of interest on the
  world map to open the town map, then a building to open its interior. Map pins link to wiki
  entities.
- **Map generation:** quick generated maps for inspiration or speed (dwellings, one-page dungeons,
  encounter terrain), in the spirit of watabou's generators. Ideally exportable to
  Dungeondraft/Wonderdraft for editing. Possibly AI-assisted, with style rules for continuity.
- **Image generation:** portraits of villains and characters, and scenery to show at the table.
  AI is allowed here, or the hub just links to a tool.
- **Virtual tabletop:** live shared battle maps with tokens, eventually replacing Roll20. Only
  worth it if the other modules go well.
- **In-person play:** make the hub useful when everyone's in the same room, not only online.
