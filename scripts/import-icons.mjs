/**
 * Regenerates the item icons (app/characters/item-icons.ts) and the token icons
 * (app/maps/tokens/token-icons.ts) from game-icons.net (CC BY 3.0), keeping each icon's author
 * for the credits. Run by hand when an icon set changes, then format:
 * `node scripts/import-icons.mjs && npx prettier --write app/characters/item-icons.ts app/maps/tokens/token-icons.ts`.
 * Only the icon's path data is kept, so tiles and tokens can draw it in the app's own colours.
 */
import { writeFile } from "node:fs/promises";

const SOURCE = "https://raw.githubusercontent.com/game-icons/icons/master";

/** Folder names in the game-icons repository, and how game-icons.net credits them. */
const AUTHORS = {
  lorc: "Lorc",
  delapouite: "Delapouite",
  willdabeast: "Willdabeast",
  lucasms: "Lucas",
  "carl-olsen": "Carl Olsen",
};

/** [id, label, source, extra keywords] — keywords help quick add guess an icon from a name. */
const ITEM_ICONS = [
  ["bag", "Bag", "lorc/swap-bag", ["pouch", "sack", "purse"]],
  ["backpack", "Backpack", "delapouite/backpack", ["pack", "knapsack"]],
  ["chest", "Chest", "delapouite/chest", ["box", "crate", "coffer"]],
  ["rope", "Rope", "delapouite/rope-coil", ["cord", "line"]],
  ["torch", "Torch", "delapouite/torch", []],
  ["lantern", "Lantern", "lorc/lantern-flame", ["lamp"]],
  ["candle", "Candle", "lorc/candle-light", []],
  ["sword", "Sword", "lorc/broadsword", ["blade", "longsword", "shortsword", "rapier", "scimitar"]],
  ["dagger", "Dagger", "lorc/plain-dagger", ["knife", "dirk"]],
  ["axe", "Axe", "lorc/battle-axe", ["hatchet", "handaxe", "greataxe"]],
  ["mace", "Mace", "lorc/spiked-mace", ["club", "morningstar", "flail", "hammer"]],
  ["spear", "Spear", "lorc/stone-spear", ["javelin", "pike", "halberd", "glaive"]],
  ["bow", "Bow", "delapouite/bow-arrow", ["longbow", "shortbow"]],
  ["crossbow", "Crossbow", "carl-olsen/crossbow", []],
  ["arrows", "Arrows", "lorc/arrow-cluster", ["arrow", "bolts", "ammunition"]],
  ["quiver", "Quiver", "delapouite/quiver", []],
  ["staff", "Staff", "lorc/wizard-staff", ["quarterstaff", "stick"]],
  ["wand", "Wand", "lorc/fairy-wand", ["rod"]],
  ["shield", "Shield", "willdabeast/round-shield", ["buckler"]],
  ["armour", "Armour", "lorc/breastplate", ["armor", "plate", "breastplate"]],
  ["leather-armour", "Leather armour", "delapouite/leather-armor", ["leather", "jerkin"]],
  ["chain-mail", "Chain mail", "willdabeast/chain-mail", ["mail", "chain"]],
  ["boots", "Boots", "lorc/boots", ["shoes"]],
  ["gloves", "Gloves", "delapouite/gloves", ["gauntlets", "wraps", "handwraps"]],
  ["cloak", "Cloak", "lucasms/cloak", ["cape", "robe"]],
  ["hat", "Hat", "lorc/pointy-hat", ["cap", "hood", "helmet"]],
  ["ring", "Ring", "delapouite/ring", ["band"]],
  ["amulet", "Amulet", "lorc/gem-pendant", ["necklace", "pendant", "locket", "talisman"]],
  ["potion", "Potion", "delapouite/health-potion", ["healing", "elixir", "tonic"]],
  ["flask", "Flask", "lorc/round-bottom-flask", ["vial", "oil", "acid", "poison"]],
  ["scroll", "Scroll", "lorc/scroll-unfurled", ["parchment"]],
  ["book", "Book", "delapouite/spell-book", ["spellbook", "tome", "journal", "diary"]],
  ["letter", "Letter", "lorc/envelope", ["note", "message", "envelope"]],
  ["map", "Map", "lorc/treasure-map", ["chart"]],
  ["key", "Key", "lorc/key", []],
  ["lockpicks", "Lockpicks", "delapouite/lockpicks", ["thieves", "picks"]],
  [
    "gem",
    "Gem",
    "lorc/cut-diamond",
    ["diamond", "ruby", "emerald", "sapphire", "jewel", "crystal"],
  ],
  ["coins", "Coins", "delapouite/two-coins", ["coin", "gold", "silver", "copper"]],
  ["bread", "Bread", "delapouite/bread", ["rations", "ration", "food", "loaf"]],
  ["meat", "Meat", "lorc/meat", ["jerky", "ham"]],
  ["cheese", "Cheese", "lorc/cheese-wedge", []],
  ["waterskin", "Waterskin", "delapouite/water-flask", ["water", "canteen"]],
  ["bottle", "Bottle", "delapouite/wine-bottle", ["wine", "ale", "beer", "drink"]],
  ["herbs", "Herbs", "delapouite/herbs-bundle", ["herb", "plant", "flower"]],
  ["bedroll", "Bedroll", "delapouite/sleeping-bag", ["blanket", "sleeping"]],
  ["tent", "Tent", "delapouite/camping-tent", []],
  ["tools", "Tools", "lorc/hammer-nails", ["tool", "kit", "nails", "crowbar"]],
  ["cooking-pot", "Cooking pot", "lorc/cauldron", ["pot", "cauldron", "mess"]],
  ["utensils", "Utensils", "lorc/kitchen-knives", ["spatula", "ladle", "cutlery", "fork", "spoon"]],
  ["instrument", "Instrument", "delapouite/flute", ["flute", "lute", "drum", "horn", "music"]],
  ["crystal-ball", "Crystal ball", "lorc/crystal-ball", ["orb", "sphere"]],
  ["holy-symbol", "Holy symbol", "lorc/holy-symbol", ["symbol", "emblem", "idol"]],
  ["compass", "Compass", "lorc/compass", []],
  ["quill", "Quill and ink", "lorc/quill-ink", ["ink", "pen", "quill"]],
  ["tooth", "Trophy", "lorc/tooth", ["tooth", "fang", "claw", "bone"]],
  ["dice", "Dice", "delapouite/dice-twenty-faces-twenty", ["die", "game"]],
  ["curio", "Curio", "lorc/magic-swirl", ["strange", "mysterious", "trinket", "magic", "odd"]],
];

/** The DM's tokens: people, creatures and points of interest. Keywords guess one from a name. */
const TOKEN_ICONS = [
  ["person", "Person", "delapouite/person", ["villager", "commoner", "npc", "man", "woman"]],
  ["hood", "Hooded figure", "lorc/hood", ["hooded", "stranger", "figure", "cloaked"]],
  ["cultist", "Cultist", "lorc/cultist", ["cult", "priest", "acolyte", "monk"]],
  ["rogue", "Rogue", "lorc/rogue", ["thief", "bandit", "assassin", "spy"]],
  ["warrior", "Warrior", "delapouite/barbarian", ["barbarian", "thug", "fighter", "mercenary"]],
  ["guard", "Guard", "lorc/visored-helm", ["soldier", "knight", "captain", "watch"]],
  ["wizard", "Wizard", "delapouite/wizard-face", ["mage", "sorcerer", "witch", "warlock"]],
  ["dwarf", "Dwarf", "delapouite/dwarf-face", []],
  ["elf", "Elf", "delapouite/woman-elf-face", []],
  ["royal", "Royalty", "lorc/crown", ["king", "queen", "prince", "princess", "lord", "lady"]],
  ["merchant", "Merchant", "delapouite/shop", ["shop", "trader", "vendor", "stall", "market"]],
  ["goblin", "Goblin", "delapouite/goblin-head", ["kobold", "imp"]],
  ["orc", "Orc", "delapouite/orc-head", ["ogre", "troll", "brute"]],
  ["dragon", "Dragon", "lorc/dragon-head", ["wyrm", "drake", "wyvern"]],
  ["wolf", "Wolf", "lorc/wolf-head", ["wolves", "dog", "hound"]],
  ["bear", "Bear", "delapouite/bear-head", []],
  ["horse", "Horse", "delapouite/horse-head", ["pony", "mount", "mule"]],
  ["cow", "Cow", "delapouite/cow", ["cattle", "livestock", "ox", "bull"]],
  ["rat", "Rat", "delapouite/rat", ["mouse", "vermin"]],
  ["ghost", "Ghost", "lorc/ghost", ["spirit", "phantom", "spectre", "wraith"]],
  ["skull", "Skull", "lorc/skull-crossed-bones", ["danger", "death", "skeleton"]],
  ["bones", "Bones", "lorc/crossed-bones", ["remains", "corpse", "body"]],
  ["chest", "Chest", "delapouite/chest", ["treasure", "loot", "box", "crate"]],
  ["locked-chest", "Locked chest", "lorc/locked-chest", ["locked", "safe", "strongbox"]],
  ["barrel", "Barrel", "delapouite/barrel", ["cask", "keg", "supplies"]],
  ["door", "Door", "delapouite/door", ["gate", "entrance", "exit"]],
  ["stairs", "Stairs", "delapouite/stairs", ["steps", "staircase", "ladder"]],
  ["cave", "Cave", "delapouite/cave-entrance", ["tunnel", "mine", "lair"]],
  ["portal", "Portal", "lorc/magic-portal", ["gateway", "rift", "teleport"]],
  ["campfire", "Campfire", "lorc/campfire", ["fire", "bonfire"]],
  ["tent", "Tent", "delapouite/camping-tent", ["camp"]],
  ["cart", "Cart", "delapouite/old-wagon", ["wagon", "caravan", "carriage"]],
  ["boat", "Boat", "delapouite/sailboat", ["ship", "ferry", "raft"]],
  ["house", "House", "delapouite/house", ["home", "cottage", "hut", "building"]],
  ["village", "Village", "delapouite/village", ["town", "hamlet", "settlement"]],
  ["castle", "Castle", "delapouite/castle", ["keep", "fort", "fortress"]],
  ["tower", "Tower", "lorc/stone-tower", ["watchtower", "spire"]],
  ["temple", "Temple", "delapouite/church", ["church", "shrine", "chapel"]],
  ["tavern", "Tavern", "lorc/beer-stein", ["inn", "pub", "ale", "innkeeper", "barkeep"]],
  ["forge", "Forge", "lorc/anvil", ["anvil", "blacksmith", "smith", "smithy"]],
  ["well", "Well", "delapouite/well", ["fountain"]],
  ["tree", "Tree", "lorc/pine-tree", ["forest", "woods", "grove"]],
  ["grave", "Grave", "lorc/tombstone", ["tomb", "graveyard", "cemetery", "crypt"]],
  ["coffin", "Coffin", "lorc/coffin", ["sarcophagus", "casket"]],
  ["trap", "Trap", "lorc/wolf-trap", ["snare", "pit"]],
  ["web", "Web", "lorc/spider-web", ["spider", "cobweb"]],
  ["cauldron", "Cauldron", "lorc/cauldron", ["brew"]],
  ["key", "Key", "lorc/key", []],
  ["coins", "Coins", "delapouite/two-coins", ["gold", "money"]],
  ["scroll", "Scroll", "lorc/scroll-unfurled", ["letter", "clue", "notice"]],
  ["map", "Map", "lorc/treasure-map", []],
  ["fight", "Fight", "lorc/crossed-swords", ["battle", "ambush", "combat"]],
  ["flag", "Flag", "lorc/flying-flag", ["banner", "waypoint"]],
  ["tracks", "Tracks", "lorc/footprint", ["trail", "footprints"]],
  ["target", "Target", "lorc/target-arrows", ["goal", "objective"]],
  ["unknown", "Unknown", "lorc/uncertainty", ["mystery", "secret", "question"]],
];

const BACKGROUND = "M0 0h512v512H0z";

async function pathData(source) {
  const response = await fetch(`${SOURCE}/${source}.svg`);
  if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
  const svg = await response.text();
  if (!svg.includes('viewBox="0 0 512 512"')) throw new Error(`${source}: unexpected viewBox`);
  const leftovers = svg.replace(/<\/?svg[^>]*>|<path[^>]*\/>/g, "").trim();
  if (leftovers) throw new Error(`${source}: has more than paths (${leftovers.slice(0, 60)})`);
  const paths = [...svg.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map((match) => match[1]);
  const icon = paths.filter((d) => d !== BACKGROUND);
  if (icon.length === 0) throw new Error(`${source}: no icon path`);
  return icon.join("");
}

async function entriesOf(icons) {
  const entries = [];
  for (const [id, label, source, keywords] of icons) {
    const folder = source.split("/")[0];
    const author = AUTHORS[folder];
    if (!author) throw new Error(`${source}: add its author to AUTHORS`);
    entries.push({ id, label, author, source, keywords, path: await pathData(source) });
  }
  return entries;
}

function fileOf({ what, typeName, constName, keywordsAre }, entries) {
  const body = entries
    .map(
      (icon) =>
        `  {\n    id: ${JSON.stringify(icon.id)},\n    label: ${JSON.stringify(icon.label)},\n` +
        `    author: ${JSON.stringify(icon.author)},\n    source: ${JSON.stringify(icon.source)},\n` +
        `    keywords: ${JSON.stringify(icon.keywords)},\n    path: ${JSON.stringify(icon.path)},\n  },`,
    )
    .join("\n");
  return `/**
 * ${what} from game-icons.net, licensed under CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/).
 * Each icon keeps its author for the credits. Generated by scripts/import-icons.mjs; don't edit
 * by hand. Paths are drawn on a 512×512 canvas.
 */

export interface ${typeName} {
  id: string;
  label: string;
  author: string;
  /** Where it came from in the game-icons repository (author folder and icon name). */
  source: string;
  /** ${keywordsAre} */
  keywords: readonly string[];
  path: string;
}

export const ${constName}: readonly ${typeName}[] = [
${body}
];
`;
}

const SETS = [
  {
    what: "Item icons",
    typeName: "ItemIcon",
    constName: "ITEM_ICONS",
    keywordsAre: "Words in an item's name that suggest this icon, besides its label.",
    icons: ITEM_ICONS,
    file: "../app/characters/item-icons.ts",
  },
  {
    what: "Token icons",
    typeName: "TokenIcon",
    constName: "TOKEN_ICONS",
    keywordsAre: "Words in a token's name that suggest this icon, besides its label.",
    icons: TOKEN_ICONS,
    file: "../app/maps/tokens/token-icons.ts",
  },
];

for (const set of SETS) {
  const entries = await entriesOf(set.icons);
  await writeFile(new URL(set.file, import.meta.url), fileOf(set, entries), "utf8");
  console.log(`Wrote ${entries.length} ${set.what.toLowerCase()}.`);
}
