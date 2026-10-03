# Roadmap

A loose, unprioritised parking lot of modules, drawn from the original project brain dump. None of
it is committed or scheduled. Everything should link through the shared campaign model (NPCs,
locations, maps, characters, sessions).

## Built

- **Hub shell:** a home page linking to table tools (Roll20) and to Guildhall's own modules.
- **Campaign wiki (read-only):** browse and search the Obsidian vault, with DM/player preview.
  Shared notes can keep DM-only parts: a `## DM` section or a `> [!dm]` callout.
- **Combat tracker:** encounters built from vault statblocks and PC notes, initiative with
  reroll tie-breaks, turns and rounds, monster HP and conditions, the statblock alongside, a dice
  roller and undo. One fight for the table, kept on the server and pushed live: players follow
  the turn order, see their own characters (hit points from their sheets) and end their own turn.
  Hidden monsters (ambushers) stay out of players' sight until revealed.
- **Prepared encounters:** set up fights before a session (monsters with rolled HP, companions,
  notes), then start them at the table by picking who's playing. Kept in the server's data folder,
  and reusable. One set up on a map starts there, with its monsters in place.
- **Click-to-roll:** attacks, damage, checks, saves, skills and recharges roll straight from the
  tracker's statblocks, labelled, with natural 20s arming a critical-damage roll.
- **Interactive maps (first slice):** maps from vault images, with outlined areas that lead to
  deeper maps and wiki notes, nesting to any depth with breadcrumbs. Drawn and reshaped in an
  editor with undo; a clean view for the table. Kept in the data folder.
- **Maps for players, with fog of war:** the DM shares a map and reveals it as the party explores
  (brush, rectangle, areas, reveal and hide all, undo); players see only what's revealed, black
  elsewhere, and reveals reach their open maps as they happen. Hidden pixels never leave the
  server: players get tiles with the fog taken out. Secret areas, and areas shown once half
  revealed.
- **Tokens on maps, shared live:** a token for each PC and the companion (their portrait, or an
  initial), and the DM's own markers with a name and a colour. Players drag their own; the DM
  moves anything; everyone sees a drag as it happens, and whoever picks a token up holds it until
  they let it go. Each party member is in one place: the maps above show a badge of who's inside
  an area, the Maps page says where you are, and Find takes you to your token. Tokens under the fog
  never reach players (except their own, "in the dark"). Fog reveals arrive the same way, live,
  over websockets on the same server, with polling when the connection drops.
- **Battle maps (first slice):** any map becomes a battle map with a grid of 5 ft squares, set up
  in the editor (scaled to fit, offset to line up with a grid in the image, lines faint or
  hidden). Tokens fill their squares, come in sizes from Medium to Gargantuan, and snap to squares
  (a switch per map, and Alt to place freely). A toolbar over the map measures true distances
  with turns, and lays out spell areas (sphere, cube, cone, line) showing who's caught.
- **The shared fight on the map:** Combat on a map's page runs the tracker beside it, with a turn
  strip over it. Monsters' tokens are linked to their combatants (sized from their statblocks, an
  HP bar for the DM, grey when down), the active one ringed for everyone. Players move only on
  their own turn, unless the DM allows free movement. End fight clears the monsters or leaves
  them as markers.
- **Stunts and quick damage:** the DM's own tools for a fight on a map. Monsters picked on the map
  take typed damage, halved or healed all at once. Stunts for thematic moments (impact, flash,
  smoke, a screen shake; a token wobbling, glowing or falling) and sounds from a vault folder play
  for everyone watching, only when the DM plays them; each viewer can turn them off or down.
- **Character sheets (first slice):** a sheet per PC note, typed in from paper, with the paper
  sheet's own maths (modifiers, proficiency, passives) and typed overrides; click any bonus to roll
  it; hit points with Heal and Damage. Players edit only their own; others see a summary. Changes
  save as they're made, merge with the DM's, and can be undone.
- **The bag:** a game-style inventory beside the sheet: item tiles with icons, drag to move, stack,
  split, equip and remove (and all by keyboard), quick add, items linked to vault item notes (DM
  parts hidden), coins, and giving: the DM to anyone, players to each other and to the party's
  shared companion.
- **Sign-in and hosting:** everyone signs in with Discord; newcomers wait for the DM, who lets
  them in and says which player they are. A Docker image with a Google Drive companion container
  that copies the vault read-only, ready for a Dokploy server (see `docs/deployment.md`).

## Parking lot

- **Player view polish:** go through the wiki as a signed-in player, with each player's own
  characters shown as theirs.
- **Battle maps, next (towards dropping Roll20):**
  - **Stunts, more:** keyboard shortcuts for favourite stunts and sounds; sounds that loop (rain,
    a tavern) until stopped; a stunt that follows its token as it moves. Only ever the DM's
    choice, never played automatically (decision 55).
  - Rulers and spell areas shown to everyone; placing a spell area from a token by keyboard.
  - **The fight, more:** conditions shown on tokens; a player's own tokens' turns flagged ("your
    turn") with a sound; moving a whole fight to another map; tidying markers left after a fight
    in one click; a fight's party brought in by those chosen to play, not the whole party.
- **Tokens, next steps:** fog clearing around the party as their tokens move, if the DM wants it;
  the DM's fog tools and token placing in the map's toolbar; icons on markers; a lock for the DM to
  stop players moving mid-scene; undo for the DM's moves; tokens for NPCs linked to their notes;
  touch dragging for tablets and phones.
- **Live, more:** the same hub for shared dice rolls (with the DM's hidden rolls), character sheet
  changes pushed rather than polled.
- **Hosting, next steps:** backups of the data folder (Dokploy volume backups, or a nightly copy to
  a separate Drive folder), a "last synced" indicator and "Sync now" for the vault copy, and
  Discord avatars.
- **Roles, more:** DM-only powers such as hidden rolls, and perhaps co-DMs.
- **Wiki, next steps:** backlinks, note transclusion (`![[Note]]`), Obsidian callouts,
  browsing by entity type, and perhaps Obsidian plugins later.
- **Character sheets, next steps:**
  - **Tracking what gets used up (first, from the first session):** the Notes tab does too much
    today; a level-1 monk with Magic Initiate already needs attacks, spells and a once-a-day spell
    there as free text. Without needing rules, as typed from paper:
    - **Spells:** spells known by level with their details (range, save or attack, damage), the
      spellcasting ability, save DC and attack bonus, and click-to-roll like the rest of the sheet.
    - **Spell slots:** total and used per level, ticked off as they're cast.
    - **Limited uses:** anything with a count and a reset (ki points, a feat's once per long rest,
      Second Wind, Channel Divinity), ticked off and shown at a glance.
    - **Hit dice and rests:** hit dice spent and left; Short Rest and Long Rest buttons that reset
      what each one resets, undoable like any change.
    - **Attacks:** a list of name, bonus and damage, each rollable, instead of lines in Notes.
  - **Rules on top:** proficiency bonus from level; species and class features; attacks worked
    out from equipped weapons; AC from armour; spells and slots; short and long rests. They'd add
    to `deriveSheet` and could flag a typed number they disagree with. The SRD (5.1 and 5.2, CC BY
    4.0) could supply the rules data and a catalogue of mundane gear for quick add, with its
    attribution.
  - **Live:** changes pushed to open sheets over websockets instead of polling.
  - **Companions, more:** a fuller companion view (sidekick levels, its own rolls from the
    statblock), beyond today's card, hit points and shared bag.
  - **Bag, more:** vault images as item icons, an item's source linked to the map area where it
    was found, a party loot view, weight and containers, and an Actions tab.
  - Creating a character in the app from scratch (D&D Beyond style), once rules exist.
- **Dice:** shared dice rolling, including DM hidden rolls. Complements physical dice on camera.
- **Combat tracker, next steps:**
  - **Target and apply:** after a hit, click the target to apply the rolled damage.
  - Click-to-roll in wiki statblocks, and in the prepared-encounter editor.
  - Condition durations, a tablet layout, damage to PCs from the tracker applied to their
    sheets.
  - Prepared encounters, next steps: link one to a wiki location or session note, group them by
    session, import Initiative Tracker `encounter` blocks from Obsidian.
  - Later: an overlay on the battle map, with flashy turn transitions and, one day, attack
    animations.
- **Interactive maps, next steps:**
  - **Fog, next steps:** exploration memory ("seen before" dimmed rather than black, a second
    mask); per-player fog when the party splits (a mask per player beside the party's); revealing
    an area's note with it; a minimap (needs an overview shrunk cell by cell, so pixels from under
    the fog can't blend in); a fog texture instead of plain black (tiles are already transparent
    outside the reveal).
  - Phones: pinch zoom, a bottom sheet for the side panel, and a lower-resolution level of tiles
    for small screens; touch-friendly handles, for a tablet at the table.
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
