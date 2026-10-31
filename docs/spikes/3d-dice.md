# Spike: 3D dice

**Date:** 2026-10-31 · **Prototype:** on the branch `claude/spike-3d-dice-3e1602`, never merged

> Kept as the research behind decision 82. The dice were then built for real: the DM chose dice
> everywhere rolls happen, on by default with a switch in Settings, the result held until the dice
> land, and dice sets the DM gives each member. Where this write-up and the code differ (file
> names, `?prototype=dice`, the questions at the end), the code and decision 82 are current.

**Question:** can Guildhall show dice that seem to roll across the screen, like Roll20's or D&D
Beyond's, and how would it fit with the `Rng`, the themes and, later, rolls shared live?

**Answer:** yes, and it's cheap to do well. three.js and cannon-es (both MIT), loaded lazily on
the first roll, can throw dice that land on a result the `Rng` has already decided. In the
prototype, 240 dice of every standard type all landed on the rolled number. Load time and size
are modest. The open questions are about the product (when it plays, and whether it's shared),
not the technology.

## Options

|                                                                                   | Licence    | Size                                                                                    | Result decided first?                                                                   | Notes                                                                                                                       |
| --------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [`@3d-dice/dice-box`](https://github.com/3d-dice/dice-box) 1.1.4                  | MIT        | Babylon.js 5 + Ammo.js (WASM), about 11 MB unpacked, with assets to copy into `public/` | **No** in its API: the result is read from the physics. A fork or patch would be needed | Best looking and runs in a worker with OffscreenCanvas. Last release Aug 2024, pinned to Babylon 5.57 (Babylon is now on 9) |
| [`@3d-dice/dice-box-threejs`](https://github.com/3d-dice/dice-box-threejs) 0.0.12 | MIT        | three 0.143 + cannon-es                                                                 | **Yes**: `roll("2d20@3,17")`                                                            | Exactly the trick we need, but last released Oct 2022 and pinned to a three.js four years old. Main-thread only             |
| **three.js + cannon-es by hand** (the prototype)                                  | MIT + MIT  | three 0.187 + cannon-es 0.20: **159 kB gzipped**, one lazy chunk                        | **Yes**, our own code (below)                                                           | About 450 lines for d4–d20. cannon-es is stable but no longer developed (0.20, 2022)                                        |
| three.js + Rapier (`@dimforge/rapier3d-compat`)                                   | Apache-2.0 | Rapier's WASM adds about 15 MB unpacked and roughly 500 kB+ over the wire               | Yes, the same way                                                                       | Actively maintained, deterministic across machines, faster. Worth it only if cannon-es causes trouble                       |

Every candidate is MIT or Apache, so none is copyleft. (Atlas VTT, AGPL, was not looked at.) All
need WebGL 1 or 2, which any browser from the last decade has. Without it, the prototype just
shows nothing beyond the text result.

**I'd pick three.js + cannon-es, written by hand**, as in the prototype:

- Deciding the result first is the one thing we can't compromise on. Of the libraries, only
  dice-box-threejs does it, and it's stale (three 0.143). Our own version is short, and we
  control it.
- It's the smallest by far: one 159 kB chunk, fetched only when someone rolls with dice turned on.
- three.js is the most used 3D library there is. If cannon-es ever causes trouble, Rapier can
  replace it behind the same `simulate()` function.

## The result decided first

The `Rng` rolls exactly as now (`rollInto` and `useRollLog` are unchanged), and the dice only
show it:

1. `rollInto` rolls with the injected `Rng`, and the result goes into the log. The Dice box shows
   only rolls up to the last one whose dice have landed. That's decided while drawing, so the
   number never flashes up first. A later one shows "Rolling…".
2. The overlay takes the dice from `result.terms[].rolls` (with advantage, both d20s; the dropped
   one is drawn faded).
3. `simulate()` runs the whole throw headless in cannon-es first, recording every frame. Six dice
   took 25–125 ms on this machine; most throws settle in about 3 s of motion.
4. For each die it finds the face on top in the last frame (for a d4, the tip). It then **swaps
   two labels**: the face on top gets the rolled value, and the face that had it gets the old
   number.
5. It plays the frames back, with the sounds of the dice hitting the table and each other. When
   the last frame is drawn, the Dice box shows the result. If the dice never land (a hidden tab
   draws nothing), the result shows after 6 s anyway. Physics only ever decides the motion, never
   the number.

The throw's start (position, spin) comes through an `Rng` too (`defaultRng` in the prototype), so
there's still no `Math.random` in app code. Physics isn't random: given the same start, it gives
the same tumble.

The label swap breaks real dice's "opposite faces add to n+1". Nobody can see the bottom face, so
it doesn't show, but a careful version would turn the whole numbering to match instead of
swapping two faces.

**Checked:** 40 rolls of d4 + d6 + d8 + d10 + d12 + d20 (240 dice), all landing on the rolled
value. The result appears only when they land: the box goes straight to "Rolling…", then to the
total about 3 s later. Also checked by eye: 1d20 → 17, 1d20 → 3, d6 → 5, d10 → 1, and 2d20 with advantage (four
d20s, two faded).

## Cost

- **Bundle:** `scene` is its own chunk: 625 kB minified, **159 kB gzipped** (158 kB over the
  wire), fetched on the first roll and cached after. The map page's own chunk only gains the
  small `DiceOverlay`. On the server it's never run: the dynamic import is inside an effect.
- **Load:** on this machine, against the production build, the chunk was ready 25 ms after the
  first roll. For a slow laptop, guessing at roughly 4× slower CPU and a 10 Mbit/s connection:
  about 130 ms to download, 150–300 ms to parse and compile, and about 100 ms to start WebGL. So
  **under half a second before the first throw**, and nothing after that. If that matters, the
  chunk can be fetched while the browser is idle once the map page is open.
- **Simulation:** 25–125 ms for six dice on this machine, perhaps up to 0.5 s on a slow laptop,
  on the main thread before the dice appear. The real version should run `simulate()` in a Web
  Worker (cannon-es runs there unchanged) and cap the number of dice.
- **Drawing:** one WebGL canvas over the map, drawing only while dice move (about 3 s), then
  removed. Nothing runs between rolls.

## Accessibility

- **The result as text, when the dice land.** The Dice box's `aria-live` line says "Rolling…",
  then the result. The canvas is `aria-hidden`. The dice are never the only way to learn a
  result, and with dice turned off the result shows at once, as now.
- **Reduced motion:** with `prefers-reduced-motion`, the prototype skips the tumble and shows the
  dice already landed, with one soft knock, and the result at once. Then it fades them (like
  stunts, decision 57).
- **Sound:** follows each viewer's stunt sound switch and volume. The real version would want its
  own "dice sounds" switch beside it.
- **A setting to turn it off:** each viewer's own on/off, kept in their browser like the stunt
  settings (`stunt-settings.ts`), and **off by default** (see the questions below). The prototype
  only has the URL switch.
- Not done: dice hidden under the Dice box at narrow widths (the throw should stay out of panels'
  way), and the canvas should go away early on Escape or a click.

## The three themes

The dice take their colours from the theme as the browser resolves it: the body is
`--color-accent` and the numbers `--color-on-accent`, read through a hidden element, so
`light-dark()` works. No colours are fixed in code:

- **Storybook:** deep teal dice, cream numbers. They suit the parchment map; they could gain gold
  numbers from `--gh-trim`.
- **Iron and Ember:** rust-red dice, pale numbers. They look like forged metal, and a little more
  `metalness` would sell it.
- **Gemlight:** pale ice-blue dice, dark numbers. They read like glass, and real transparency
  (`MeshPhysicalMaterial` with transmission) would suit it, at some cost in drawing.

Numbers use a serif font now; the real version would use each theme's `--gh-font-display`. Each
theme could get its own material settings through new `--gh-dice-*` variables, the way themes
decorate everything else, never in components.

## Dice looks, and giving them to players

**How hard:** a look is a handful of values (`DiceLook` in `scene.ts`): body and number colours,
the font, how metallic, how rough, how see-through. The prototype has four
(`&dice=gilded|glass|bone|blood`) beside the theme's own. In rough order of effort:

- **Colours, finishes and fonts** (what the prototype does): easy. Making a new set is a few lines.
- **Patterns** (marble, swirls, speckles, glitter): moderate. They need a texture or a small
  shader for the body. The numbers stay as they are.
- **Real glass or gemstone** (light bending through the die): moderate, and heavier to draw. It
  needs `MeshPhysicalMaterial` with transmission and a reflection map. It could be kept to one
  "special" set.
- **Its own sound** (metal clinks, stone clacks): easy. The pitch and ring change with the set.
- **Custom shapes** (a skull d20, sculpted dice from a 3D model): hard. The trick of swapping the
  numbers needs to know where every face is, so each model needs its face positions written down
  by hand, and its numbers must be separate from the model's own texture.

**Giving them out:** about one slice for the first part, built like themes and items:

- Sets are defined in code (or a JSON file in the repo), each with an ID and a name. They're not
  in the vault, since they're app looks, not story.
- Each member's account gets the sets they have and the set they use, kept in `members.json`
  beside their theme, with a default for everyone.
- The DM gives a set from Members (or the way items are given). A player chooses theirs in
  Settings, from the sets they have.
- Where it shows: the DM's dice use the DM's set. A player's set shows when they roll in
  Guildhall (click-to-roll on their sheet), and others see it only once rolls are shared (the
  roll's message carries the roller's set, below). Since your table rolls real dice, players
  would mostly see their set when rolling from their sheet.

## Shared rolls later: a sketch

Not built, and parked by the table's own choice (they roll real dice and like it). If it's ever
wanted:

- **Where it's rolled:** on the **server**, for rolls others will see. The browser sends a request
  ("1d20+5, attack, label, visibility"), and the server rolls with its own `Rng` through the same
  `rollInto` (it's isomorphic). Nobody can then fake a roll from the browser. The DM's private
  rolls can stay in the browser as now, since nobody else sees them.
- **What's sent:** a new `ServerMessage`:
  `{ type: "roll", room, roll: LoggedRoll, by, look: string, throw: number }`, where `look` is the
  roller's dice set and `throw` is a seed for the
  throw's motion. Each browser runs the same simulation from the same seed and swaps the labels to
  the result. If two browsers' physics differ slightly, the dice still land on the right number,
  because the swap happens after the simulation in each browser.
- **Built per viewer:** through `LiveHub.publish(room, viewer => message)`, like stunts. For a
  hidden DM roll (a monster's secret save, a hidden monster's attack), the builder returns
  `undefined` for every player, so the roll never reaches a player's connection, not even
  redacted. A DM roll the DM chooses to show goes to everyone. Hidden monsters' names in labels
  get the same check as `fightForViewer`.
- **Players seeing others' rolls:** a player's roll from their sheet goes to the room (the fight's
  room, or the map they're on), built for each viewer, with each viewer's own on/off setting.
  Nothing is kept beyond a short in-memory recent list for whoever joins mid-fight. Like stunts,
  no history is stored.
- **Who triggers it:** only the person who rolls. Nothing rolls by itself (decision 55), and the
  DM's rolls stay private unless the DM chooses otherwise.

## Risks

- **It cuts against the table's own taste.** The table loves rolling real dice on camera.
  Tumbling dice on screen could become the thing people watch instead. Keep them small, short,
  optional and off by default, and only for the DM's rolls at first.
- **Physics tuning.** A throw now ends once every die is all but still. 15 throws of four dice
  took 2.2–3.5 s (median 2.8 s), and the result waits for that. The real version wants a "settle"
  step (ease each die flat onto its face at the end) and tuned damping, so every throw ends in
  about 2 s.
- **Waiting for the dice slows combat a little.** Each roll's number arrives about 3 s later. A
  click on the dice to skip to the end would help.
- **The sound is synthesised, not recorded.** It's made on the spot with Web Audio (filtered
  noise for knocks, a low rumble while rolling), so there are no files and no licences to worry
  about. Recorded dice samples (CC0 ones exist) would sound more real, at about 50–100 kB. Not
  yet judged by ear.
- **Critical gives it away:** after a natural 20 on an attack, the Critical box ticks itself at
  once, before the dice land. The real version would hold that back too.
- **Odd dice:** d2, d3, d100, d7, d1000 and so on aren't drawn (the text still shows them). d100
  would need a percentile d10 pair; the rest can stay text. At most 10 dice are drawn: 8d6 of
  Fireball is fine, but 20d6 shows 10.
- **Maintenance:** cannon-es is unmaintained (it works, but no fixes are coming). three.js changes
  its API often, and minor releases break things; pin it and update deliberately.
- **WebGL on weak machines:** a second WebGL context beside nothing else is fine. Losing the
  context (sleeping laptops) must be handled by just not drawing.
- **Dev-server hiccup:** adding the dependencies made Vite re-bundle them mid-session, which broke
  that page load (two Reacts) until a restart. That's a one-off for whoever installs it, not a
  bug, but it's worth adding `three` and `cannon-es` to `optimizeDeps.include`.

## Questions for the DM

1. **Do you want this at all, now?** The table rolls real dice. Is this for the DM's monster
   rolls only (fun on a shared screen), or not yet?
2. **When does it play?** On every roll, or only when the DM asks for it (a "Throw" button, or a
   modifier key), in the spirit of decision 55?
3. **Is waiting about 3 s for the number fine in combat?** The prototype now holds the number
   until the dice land, as you asked. Should a click skip to the end?
4. **On or off by default,** for each viewer?
5. **Shared rolls ever?** If yes: server-rolled, players' rolls visible to everyone, and DM rolls
   private unless shown? That's a slice of its own, after this one.
6. **Look:** the theme's accent colours (as now), or proper per-theme dice (gold on teal for
   Storybook, metal for Iron and Ember, glass for Gemlight)?
7. **Dice sets for players:** which sets first, and does giving one belong with items (a gift)
   or on the Members page? Do players see each other's dice only when rolls are shared?
8. **Sound:** keep it synthesised, or use recorded dice samples?
