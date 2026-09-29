import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("wiki", "routes/wiki.tsx", [
    index("routes/wiki-home.tsx"),
    // Every other /wiki/* path is a vault note, so note names can never clash with app pages.
    route("*", "routes/wiki-note.tsx"),
  ]),
  route("combat", "routes/combat.tsx"),
  route("combat/prepared", "routes/combat-prepared.tsx"),
  route("combat/prepared/:id", "routes/combat-prepared-edit.tsx"),
  route("maps", "routes/maps.tsx"),
  route("maps/:id", "routes/map-view.tsx"),
  route("maps/:id/edit", "routes/map-edit.tsx"),
  route("maps/:id/image", "routes/map-image.ts"),
  route("maps/:id/fog", "routes/map-fog.ts"),
  route("maps/:id/tiles/:x/:y", "routes/map-tile.ts"),
  route("maps/:id/version", "routes/map-version.ts"),
  // PROTOTYPE (removed before the PR).
  route("maps/:id/tokens-prototype", "routes/map-tokens-prototype.tsx"),
  route("vault-asset/*", "routes/vault-asset.ts"),
  route("view-mode", "routes/view-mode.ts"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  route("auth/discord", "routes/auth-discord.ts"),
  route("auth/discord/callback", "routes/auth-discord-callback.ts"),
  route("waiting", "routes/waiting.tsx"),
  route("members", "routes/members.tsx"),
  route("characters", "routes/characters.tsx"),
  route("characters/:id", "routes/character.tsx"),
  route("characters/:id/portrait", "routes/character-portrait.ts"),
  route("characters/:id/changes", "routes/character-changes.ts"),
  route("characters/:id/give", "routes/character-give.ts"),
  route("credits", "routes/credits.tsx"),
] satisfies RouteConfig;
