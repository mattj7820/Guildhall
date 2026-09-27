---
type: npc
---
# Fixture Minion

Fixture: the combat tracker's main test monster. DM-only (no visibility field). Known numbers make
rolls predictable: DEX 14 (+2 initiative), AC 13, 7 HP from 2d6 hit dice. It also has a saving
throw, a skill and a recharge ability, so every kind of click-to-roll can be tested.

```statblock
name: Fixture Minion
size: Small
type: humanoid
alignment: unaligned
ac: 13 (fixture armor)
hp: 7
hit_dice: 2d6
speed: 30 ft.
stats:
  - 8
  - 14
  - 10
  - 10
  - 8
  - 8
saves:
  - dexterity: 4
skillsaves:
  - stealth: 6
cr: 1/8
actions:
  - name: Fixture Jab
    desc: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) damage."
  - name: Fixture Burst (Recharge 5–6)
    desc: Fixture recharge text.
```
