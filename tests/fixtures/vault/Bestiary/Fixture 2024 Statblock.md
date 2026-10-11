---
type: npc
---
# Fixture 2024 Statblock

Fixture: a statblock written the 2024 way. Its initiative (+3) differs from its DEX modifier (+1),
so the tracker must use the statblock's own; its attack says "Attack Roll: +5" rather than "+5 to
hit", its save says "Dexterity Saving Throw: DC 12", and it lists gear. DM-only.

```statblock
name: Fixture 2024 Statblock
size: Medium
type: humanoid
alignment: unaligned
ac: 14
initiative: 3
hp: 11
hit_dice: 2d8 + 2
speed: 30 ft.
stats:
  - 10
  - 12
  - 12
  - 10
  - 10
  - 10
gear: Fixture Spear
cr: 1/2
actions:
  - name: Fixture Thrust
    desc: "Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d8 + 2) Piercing damage."
  - name: Fixture Flash
    desc: "Dexterity Saving Throw: DC 12, each creature in a 10-foot Emanation. Failure: 7 (2d6) Radiant damage. Success: Half damage."
```
