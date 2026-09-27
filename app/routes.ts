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
  route("maps/:id/image", "routes/map-image.ts"),
  route("vault-asset/*", "routes/vault-asset.ts"),
  route("view-mode", "routes/view-mode.ts"),
] satisfies RouteConfig;
