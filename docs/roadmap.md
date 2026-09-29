# Roadmap

A loose, unprioritised parking lot of modules, drawn from the original project brain dump. None of
it is committed or scheduled. Everything should link through the shared campaign model (NPCs,
locations, maps, characters, sessions).

## Built

- **Hub shell:** a home page linking to table tools (Roll20) and to Guildhall's own modules.
- **Campaign wiki (read-only):** browse and search the Obsidian vault, with DM/player preview.
  Shared notes can keep DM-only parts: a `## DM` section or a `> [!dm]` callout.
- **Combat tracker (first slice, DM only):** encounters built from vault statblocks and PC notes,
  initiative with reroll tie-breaks, turns and rounds, monster HP and conditions, the statblock
  alongside, a dice roller and undo. The encounter is kept in the browser.
- **Prepared encounters:** set up fights before a session (monsters with rolled HP, companions,
  notes), then start them at the table by picking who's playing. Kept in the server's data folder,
  and reusable.
- **Click-to-roll:** attacks, damage, checks, saves, skills and recharges roll straight from the
  tracker's statblocks, labelled, with natural 20s arming a critical-damage roll.
- **Interactive maps (first slice, DM only):** maps from vault images, with outlined areas that
  lead to deeper maps and wiki notes, nesting to any depth with breadcrumbs. Drawn and reshaped in
  an editor with undo; a clean view for the table. Kept in the data folder.
- **Sign-in and hosting:** everyone signs in with Discord; newcomers wait for the DM, who lets
  them in and says which player they are. A Docker image with a Google Drive companion container
  that copies the vault read-only, ready for a Dokploy server (see `docs/deployment.md`).

## Parking lot

- **Player view polish (next):** go through the wiki, combat tracker and maps as a signed-in
  player: map visibility controls and a player map view, the turn order for everyone, and each
  player's own characters shown as theirs (`Viewer.playerId` is now set).
- **Counters on maps (after that):** tokens the DM and players can move on a map, shared live, which
  brings websockets on the same Express server.
- **Hosting, next steps:** backups of the data folder (Dokploy volume backups, or a nightly copy to
  a separate Drive folder), a "last synced" indicator and "Sync now" for the vault copy, and
  Discord avatars.
- **Roles, more:** DM-only powers such as hidden rolls, and perhaps co-DMs.
- **Wiki, next steps:** backlinks, note transclusion (`![[Note]]`), Obsidian callouts,
  browsing by entity type, and perhaps Obsidian plugins later.
- **Character sheets:** create a character in-app (D&D Beyond style), view the sheet, and click
  stats to roll.
- **Dice:** shared dice rolling, including DM hidden rolls. Complements physical dice on camera.
- **Combat tracker, next steps:**
  - **Target and apply:** after a hit, click the target to apply the rolled damage.
  - Click-to-roll in wiki statblocks, and in the prepared-encounter editor.
  - **Player view:** the turn order for everyone, with details only for your own PC and
    companions. The model and filter exist (`encounterForViewer`); this needs real player
    identities and a server-held, shared encounter (websockets on the same Express server).
  - Hidden combatants (ambushers), condition durations, a tablet layout.
  - Prepared encounters, next steps: link one to a wiki location or session note, group them by
    session, import Initiative Tracker `encounter` blocks from Obsidian.
  - Later: an overlay on the battle map, with flashy turn transitions and, one day, attack
    animations.
- **Interactive maps, next steps:**
  - **Player view:** players browse only the maps and areas the DM has revealed. The model, the
    filter (`mapView`) and its tests exist; this needs visibility toggles in the editor and a
    decision on whether revealing a map should also reveal its image to the wiki.
  - Revealing as the party explores: fog of war, or a live reveal during a session (needs the
    shared, server-held state from the multiplayer work).
  - Touch: pinch zoom and touch-friendly handles, for a tablet at the table.
  - A downscaled preview of very large images, for playing over a slow connection.
  - Reading Wonderdraft or Dungeondraft files directly (their labels could suggest areas).
  - Pins and labels as well as outlines; searching areas; an area's own short description.
- **Map generation:** quick generated maps for inspiration or speed (dwellings, one-page dungeons,
  encounter terrain), in the spirit of watabou's generators. Ideally exportable to
  Dungeondraft/Wonderdraft for editing. Possibly AI-assisted, with style rules for continuity. The
  natural entry point is an interactive-map area that isn't mapped yet: "Generate a map" beside
  "Attach a map", creating a map and linking the area the same way.
- **Image generation:** portraits of villains and characters, and scenery to show at the table.
  AI is allowed here, or the hub just links to a tool.
- **Virtual tabletop:** live shared battle maps with tokens, eventually replacing Roll20. Only
  worth it if the other modules go well.
- **In-person play:** make the hub useful when everyone's in the same room, not only online.
