---
visibility: dm
---
# Fixture Maps

Fixture: explains the placeholder images in this folder, which the maps module's tests use.

- Fixture World.png: 400×200, deliberately not square, so aspect-ratio mistakes show.
- Fixture Town.png: 200×200, a child map.
- Fixture Keep.png: 100×100, a grandchild map.
- Fixture Duplicate.png: the same file name exists in Attachments, so a moved image can't be
  matched by name.
- Fixture Fog.png: 1024×512, a green left half and a blue right half with a grid, and a magenta
  square in the bottom-right corner (x 960 to 1023, y 448 to 511), the only magenta anywhere.
  Tests of fog of war keep that corner hidden and check that no magenta reaches a player.

None of them are embedded in a note, so players can't load them through the wiki.
