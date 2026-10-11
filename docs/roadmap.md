# Roadmap

A loose, unprioritised parking lot of modules, drawn from the original project brain dump. None of
it is committed or scheduled. Everything should link through the shared campaign model (NPCs,
locations, maps, characters, sessions).

## Built

- **Hub shell:** a home page linking to Guildhall's own modules.
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
- **NPC tokens and the Tokens tab:** NPCs on maps from their vault notes, drawn with the note's
  picture under a name of the DM's own (a hooded figure stays hooded), and markers with built-in
  icons. Added and placed in a couple of clicks, several at a time numbered, shown or hidden in
  one click, set aside off the map to place again later, and sent between maps. All in a Tokens
  tab of the DM's side panel, beside the map's note and areas and the fight. Players see only
  what's shown and revealed, and never the note.
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
- **Character sheets, round two: what gets used up.** Spell slots, hit dice and features' uses as
  lit pips, ticked off in one click; features (class, species, feat, item) by how they're used, as
  a reminder of what a character can do; attacks and spells (by level, with their details, linked
  to vault spell notes) rolled with a click and cast from the sheet; concentration; filters as on
  D&D Beyond's sheet; Short and Long rest (2024 rules), each one step to undo. Typed from paper,
  with no rules engine.
- **The sheet beside the map:** a player's side panel on a map has Map, Sheet and Bag tabs, at
  one width, folding away for more map, with C and I to open them.
- **Preparing spells:** a character keeps their whole list and ticks which spells are ready today
  in Prepare mode, against a typed "Spells to prepare" (over it warns, never blocks). Day to day
  only what's ready is shown, on the sheet and beside the map; cantrips and a feat's free spell are
  always ready. A long rest offers to change them.
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
  the DM's fog tools and token placing in the map's toolbar; a lock for the DM to stop players
  moving mid-scene; undo for the DM's moves; touch dragging for tablets and phones.
  - **NPCs, more:** a link to a shown NPC's wiki note for players, when they may read it and the
    token goes by the note's own name; a tokens folder in the vault for custom art; monsters from
    statblocks as tokens outside a fight; dragging a token from the Tokens tab onto the map.
  - **Handouts:** the DM showing a note or image to the players as a pop-up on the map page, kept
    for them to re-read, in a Handouts tab beside Tokens.
- **Live, more:** the same hub for shared dice rolls (with the DM's hidden rolls), from the
  sheet beside the map too; character sheet changes pushed rather than polled (decision 64).
- **Hosting, next steps:** backups of the data folder (Dokploy volume backups, or a nightly copy to
  a separate Drive folder), a "last synced" indicator and "Sync now" for the vault copy, and
  Discord avatars.
- **Roles, more:** DM-only powers such as hidden rolls, and perhaps co-DMs.
- **Wiki, next steps:** backlinks, note transclusion (`![[Note]]`), Obsidian callouts,
  browsing by entity type, and perhaps Obsidian plugins later.
- **Character sheets, next steps:**
  - **SRD monsters** (next): creatures for the combat tracker's catalogue from the SRD, in both
    5.1 (2014) and 5.2 (2024), each tagged with its version. Bundled as data made by a script
    (like `scripts/import-icons.mjs`), never fetched while the app runs, and credited on
    `/credits` (CC BY 4.0).
  - **An SRD spell picker** (after that): add a spell by searching the SRD (both versions,
    tagged), with its details filled in, or a class's whole list to prepare from. Spells that
    aren't in the SRD come from the DM's own vault spell notes, never the repo.
  - **Always-prepared spells** from a subclass or feature, which don't count towards the number
    (one more case in `alwaysReady`).
  - **The DM's view of the party beside the map:** each PC's hit points, concentration, and slots
    and uses left, read-only in a Party tab of the DM's side panel (concentration matters most:
    a hit means a check).
  - **Spells and the map:** "Show on map" from a spell, opening the spell area tool with its
    shape and size (spells already keep them in the map's own shapes).
  - **Companions' recharges:** a simple toggle for a statblock's recharge ability (the blink dog's
    teleport), kept with the companion.
  - Conditions on the sheet, if the table wants them outside fights (the tracker keeps them in a
    fight); editing beside the map, if the compact view is too little.
  - **Rules on top:** proficiency bonus from level; species and class features; attacks worked
    out from equipped weapons; AC from armour; spell slots from class and level, spells from the
    SRD, uses that scale with level, and rest rules (decision 61 keeps typed values beside them).
    They'd add to `deriveSheet` and could flag a typed number they disagree with. The SRD (5.1 and
    5.2, CC BY 4.0) could supply the rules data and a catalogue of mundane gear for quick add, with
    its attribution.
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
