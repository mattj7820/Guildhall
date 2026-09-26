---
visibility: players
type: npc
---
# Test Creature

Fixture: statblocks in the Obsidian Fantasy Statblocks plugin format. The first renders as a
formatted statblock; the second is unreadable and must fall back to showing the original block.

```statblock
name: Test Creature
size: Small
type: construct
subtype: ""
alignment: unaligned
ac: 17
hp: 17
hit_dice: 5d6 + -1
speed: 30 ft.
stats:
  - 12
  - 15
  - 11
  - 1
  - 5
  - 1
saves:
  - dexterity: 4
skillsaves:
  - perception: 3
damage_immunities: poison
senses: passive Perception 13
languages: ""
cr: 1/4
traits:
  - name: Test Trait
    desc: Fixture trait text.
actions:
  - name: Test Slam
    desc: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) damage."
reactions:
  - name: Test Reaction
    desc: Fixture reaction text.
```

```statblock
ac: 12
```
