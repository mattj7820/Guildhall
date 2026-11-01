# Prompt: Guildhall's hub town map, for the mapgen repo

Paste everything below the line into a Claude session in the map-generation repo. It's
self-contained: Guildhall's coordinates are copied in, and the app is the source of truth for
them (`app/home/town.ts` and `app/components/home/TownMap.tsx` in Guildhall). If either changes,
update this prompt from those files.

Decided with the owner (2026-11-01): **one image per theme** (three), drawn from one shared
layout, and **committed to the Guildhall repo** as static UI art (`public/town/`), the first
generated images it holds.

---

## Task

Make the background art for Guildhall's front page: a top-down plan of a small walled guildhall
and its grounds. Guildhall is a D&D campaign hub; each building is a part of the app, and the
viewer's token walks dashed paths between them. **The app draws everything interactive over your
image**: labels, the token and other people, the dashed paths, hover outlines, and the live
markers (a fight's pulse, pins, badges). Your image is the scenery under them, so it has to line
up exactly with the coordinates below.

Work as usual in this repo: draw the layout in code at exact coordinates first, render a still,
check it against the coordinates (overlay the paths and outlines below and look), and only then
restyle with the image model if it helps. Show me the layout check before any restyling.

## Canvas

- The plan's units are **1000 × 700**, origin top left, y down. Everything below is in these
  units.
- Render at **2000 × 1400** (2× the units), so the art stays sharp on large and high-density
  screens. The app scales it to fit, from about 600 px wide on phones to about 1100 px on desktops.
- Deliver **WebP, quality ~82**, aiming for under 400 KB each, plus a lossless PNG master of each.
- File names: `town-storybook.webp`, `town-ember.webp`, `town-gem.webp` (and `.png` masters).
- Also write `town-check.png`: the Storybook render with every outline and path below drawn over
  it in thin bright lines, for checking alignment.

## Hard rules

- **True top-down, orthographic.** A floor plan seen from straight above: no isometric angle, no
  perspective, no visible building sides or roofs leaning, no shadows that suggest a camera
  tilt. Image models drift towards isometric; reject and redo any render that does.
- **No text at all**: no labels, letters, numbers, runes, signatures or map titles. No banners or
  heraldry with writing. The app draws all words.
- **No lore or story content**: no named places, crests, symbols that imply a faction, or
  characters. Furniture and scenery only.
- **No people, creatures or tokens.** The app draws who's there.
- Keep **label areas calm**: around each label point (below), a patch of about 160 × 50 units of
  plain floor with no busy detail, so the app's words read cleanly.
- Every **dashed path** must run over walkable ground (floor, corridor, courtyard paving), never
  through walls, trees or water.

## Layout

The SVG path data is exact; use it as the shapes. "Floor" means an interior floor, drawn inside
walls about 15 units thick (the walls straddle the outline).

### Places (buildings)

| Place                | Part of the app | Floor outline (SVG path)                                                                                     | Label point |
| -------------------- | --------------- | ------------------------------------------------------------------------------------------------------------ | ----------- |
| Great Hall           | Front page      | `M375,250 L625,250 L655,295 L655,420 L345,420 L345,295 Z`                                                    | 500, 318    |
| Library              | Wiki            | `M120,195 L262,168 L298,236 L290,355 L148,372 L108,285 Z` plus a round tower: circle centre 125,183, r 50    | 205, 292    |
| Chart Tower          | Maps            | circle centre 500,138, r 64                                                                                  | 500, 176    |
| War Room             | Combat          | `M870,297 L870,363 L823,410 L757,410 L710,363 L710,297 L757,250 L823,250 Z` (octagon)                        | 790, 312    |
| Steward's Office     | Members         | `M690,145 L820,128 L852,205 L735,228 Z`                                                                      | 770, 182    |
| Barracks             | Characters      | `M165,400 L305,392 L325,470 L295,545 L175,545 L140,470 Z`                                                    | 232, 478    |
| Treasury             | Dice            | `M725,440 L850,432 L868,515 L735,528 Z`                                                                      | 797, 474    |
| Notice board (small) | Next session    | a free-standing board in the courtyard: `M555,506 h66 v40 h-66 z`, posts at its bottom corners down to y 550 | 588, 562    |

Furnishings that fit each room's purpose, kept low-contrast and away from label points: the hall
a long table across 420–580 at y 368–384 and a dais at 470–530, y 256–268; the Library
shelves along its walls; the Chart Tower a round map table (centre 500,128, r 24); the War Room
a round table (centre 790,345, r 26) and two braziers at 722,312 and 722,350 by its door
(unlit: the app adds the fire); the Barracks bunks; the Treasury chests; the Steward's Office a
desk. The Steward's Office must look like an ordinary building: players see the art too, and only
the DM's view names it.

### Corridors

Winding corridors join each room to the hall or courtyard. Draw each as a floored corridor about
20 units wide inside walls (about 34 units across in all), following these curves:

- Library: `M345,388 C300,392 335,322 292,322`
- Chart Tower: `M500,252 C470,232 540,222 500,203`
- War Room: `M655,352 C685,372 680,312 712,330`
- Steward's Office (from the War Room's north side): `M790,252 C805,238 770,236 782,222`
- Barracks (from the courtyard): `M420,470 C380,490 350,450 318,468`
- Treasury (from the courtyard): `M580,470 C640,495 690,450 728,478`

The hall has a door onto the courtyard on its south wall: an opening from x 478 to 522 at y 410–430.

### Grounds

- **Curtain wall**, about 16 units thick, enclosing a paved courtyard and the buildings:
  `M560,586 L895,540 L925,340 L890,150 L740,78 L500,58 L260,80 L110,140 L80,340 L120,550 L440,586`.
  The gap from 440 to 560 at y 586 is the **gate**, open to the road.
- **Towers** on the wall (round, floored, walled): 110,140 r 22; 890,150 r 22; 895,540 r 22;
  120,550 r 22; 80,340 r 18; 925,340 r 18; and the gate towers 440,590 r 18 and 560,590 r 18.
  A flagpole stands at 500,52 to 500,82 on the Chart Tower (no flag: the app draws it).
- **Courtyard**: everything inside the curtain wall that isn't a building is paved (cobbles).
  Keep a clear paved way from the hall's door (500,430) straight down to the gate (500,586).
- **Well** in the courtyard: centre 415,500, outer r 15, water r 7.
- **Garden** inside the wall, north-west: an oval lawn centred 345,128 (rx 58, ry 30) with three
  small trees at 318,118, 372,122 and 345,108.
- More trees inside the wall at 640,520, 360,540, 660,140 and 860,250 (canopy r about 15).
- **Approach road**, about 34 wide, from the gate down off the bottom edge:
  `M470,712 C420,676 572,656 522,622 C496,604 504,596 500,586`.
- **Pond** outside the wall, bottom left: an oval centred 175,645 (rx 62, ry 24), in a lawn
  centred 140,640 (rx 120, ry 44). Another lawn bottom right centred 900,640 (rx 140, ry 50).
- **Trees outside** the wall (canopy r about 14–20): 40,60; 70,110; 30,200; 40,420; 30,520;
  960,90; 970,250; 960,430; 980,520; 640,650; 700,630; 760,680; 330,650; 290,680; 600,690;
  950,690; 210,30; 820,30; 620,25.
- Everything else outside the wall is open grassland.

### The dashed paths (drawn by the app, for checking)

The viewer stands in the hall at 500,365. These are the walks the app draws; overlay them in
`town-check.png` and make sure each stays on floor or paving:

- Library: `M500,365 L500,388 L345,388 C300,392 335,322 292,322 L205,300`
- Chart Tower: `M500,365 L500,252 C470,232 540,222 500,203 L500,184`
- War Room: `M500,365 L500,352 L655,352 C685,372 680,312 712,330 L790,345`
- Steward's Office: `M500,365 L500,352 L655,352 C685,372 680,312 712,330 L790,300 L790,252 C805,238 770,236 782,222 L770,196`
- Barracks: `M500,365 L500,470 L420,470 C380,490 350,450 318,468 L232,490`
- Treasury: `M500,365 L500,470 L580,470 C640,495 690,450 728,478 L797,492`
- Notice board: `M500,365 L500,470 L556,536`

Other people stand in the hall at 440,398; 560,398; 410,350; 590,350; 470,290; 530,290: keep
those spots plain floor too.

## The three themes

Same layout, same coordinates, three looks. Each must keep enough contrast for the app's words
and dashed lines on top (the app draws labels in the theme's ink with a halo of the floor colour).

- **Storybook** (light): a hand-drawn, hand-inked plan on warm parchment, like a picture-book map.
  Warm brown ink walls (around #5b4330) with a slightly wobbly hand line, cream plank or flagstone
  floors (#f8f0da), sandy cobbles (#e6dcc2), soft green grass (#cfdcae, #b7cc8f), teal water
  (#9cc7c9), rounded green trees. Gentle watercolour wash, no hard shadows.
- **Iron and Ember** (dark): dark laid stone at night. Near-black ground (#1b1815), dark slate
  floors in square flags (#2e2824), cobbles #1d1a17, walls of visible laid blocks (#57493f with
  darker mortar), dark water (#1c2f3a), dark trees (#34402b). Warm firelight only as faint glows
  near doors and the War Room's braziers; mostly dark and quiet so the app's orange accents stand
  out.
- **Gemlight** (dark): a glowing architect's plan. Deep navy ground (#08111f), floors as a fine
  blue grid on #11223e, walls drawn as luminous pale-blue lines (#8fd3ff) with a soft glow,
  courtyard as a sparse dot grid, water #123a5a, trees as dark teal discs (#0f3a33). Clean and
  geometric, like light on glass.

## Done

Show me `town-check.png` and the three renders. When they line up, they go into Guildhall at
`public/town/town-storybook.webp`, `town-ember.webp` and `town-gem.webp` (the owner copies them
across; this repo doesn't write to Guildhall), where the app shows each theme's image under the
plan it draws now.
