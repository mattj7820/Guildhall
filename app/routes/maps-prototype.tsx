/**
 * PROTOTYPE (deleted once the look is chosen): the Maps page in three layouts and areas on a map
 * in five styles, with switches, in the real themes. DM only. Thumbnails here are the DM's whole
 * images shrunk by the browser; the real ones will be made on the server, fog-safe for players.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { loadMapView, mapSource } from "~/.server/maps/load";
import { loadMapTokens, whereabouts } from "~/.server/maps/tokens";
import { requireDm } from "~/.server/not-found";
import { MapCanvas } from "~/components/maps/MapCanvas";
import {
  AREA_STYLES,
  PrototypeArea,
  type AreaStyle,
} from "~/components/maps/prototype/PrototypeAreas";
import { buttonClass, labelClass, panelClass, primaryButtonClass } from "~/components/styles";
import { servicesContext, viewerContext } from "~/context";
import { ancestors, mapTree, type MapTreeNode } from "~/maps/tree";
import type { PartyFace } from "~/maps/tokens/types";
import type { AreaView } from "~/maps/types";
import { mapEditUrl, mapImageUrl, mapUrl } from "~/maps/urls";
import { THEME_INFO, THEMES, type Theme } from "~/theme/themes";
import type { Route } from "./+types/maps-prototype";

export function meta() {
  return [{ title: "Maps prototype · Guildhall" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  requireDm(viewer);
  const services = context.get(servicesContext);
  const all = await services.maps.list();
  const party = await whereabouts(services, viewer);
  const list = await Promise.all(
    all.map(async (map) => {
      const source = await mapSource(services, map);
      return {
        id: map.id,
        name: map.name,
        shared: map.visibility === "players",
        areas: map.areas.map(({ id, name, map: child }) => ({ id, name, map: child })),
        thumbnail: source ? mapImageUrl(map.id, source.version) : undefined,
      };
    }),
  );
  // Who's on each map or anywhere inside it.
  const faces: Record<string, PartyFace[]> = {};
  for (const member of party) {
    if (!member.map) continue;
    const face = { name: member.name, portraitUrl: member.portraitUrl };
    for (const on of [member.map.id, ...ancestors(member.map.id, list).map((each) => each.id)]) {
      (faces[on] ??= []).push(face);
    }
  }

  const wanted = new URL(request.url).searchParams.get("map");
  const chosen =
    all.find((map) => map.id === wanted) ??
    [...all].sort((a, b) => b.areas.length - a.areas.length)[0];
  const view = chosen && (await loadMapView(services, chosen, all, viewer));
  const inside = chosen ? (await loadMapTokens(services, chosen, viewer)).inside : [];
  return { tree: mapTree(list), party, faces, view, inside };
}

type Data = Route.ComponentProps["loaderData"];
type Listed = Data["tree"][number]["map"];
type Node = MapTreeNode<Listed>;

const LAYOUTS = { tree: "Tree with thumbnails", cards: "Card grid", atlas: "Atlas" } as const;
type Layout = keyof typeof LAYOUTS;

export default function MapsPrototype({ loaderData }: Route.ComponentProps) {
  const [layout, setLayout] = useState<Layout>("tree");
  const [style, setStyle] = useState<AreaStyle>("pins");
  const [player, setPlayer] = useState(false);
  const [theme, setTheme] = useState<Theme | "">("");

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <div className={`${panelClass} flex flex-col gap-2`}>
        <p className="text-sm text-muted">
          Prototype: try the switches, then tell me which you like. Thumbnails here are your whole
          images shrunk by the browser (slow); the real ones will be small and fog-safe.
        </p>
        <Choice label="Theme" value={theme} options={themeOptions} onChange={setTheme} />
        <Choice label="Maps page" value={layout} options={LAYOUTS} onChange={setLayout} />
        <Choice label="Areas" value={style} options={AREA_STYLES} onChange={setStyle} />
        <Choice
          label="Look as"
          value={player ? "player" : "dm"}
          options={{ dm: "DM", player: "A player (shared maps, one area style)" }}
          onChange={(value) => setPlayer(value === "player")}
        />
      </div>

      <MapsPage data={loaderData} layout={layout} player={player} />
      {loaderData.view && (
        <AreasOnAMap data={loaderData} view={loaderData.view} style={style} player={player} />
      )}
    </main>
  );
}

const themeOptions = {
  "": "My own",
  ...Object.fromEntries(THEMES.map((theme) => [theme, THEME_INFO[theme].label])),
} as Record<Theme | "", string>;

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className={`${labelClass} float-left mr-2 w-24`}>{label}</legend>
      {(Object.keys(options) as T[]).map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          className={value === key ? primaryButtonClass : buttonClass}
          onClick={() => onChange(key)}
        >
          {options[key]}
        </button>
      ))}
    </fieldset>
  );
}

/* The Maps page */

function onlyShared(nodes: Node[]): Node[] {
  // A player sees shared maps, nested as shared maps lead to each other.
  return nodes.flatMap((node) =>
    node.map.shared
      ? [{ map: node.map, children: onlyShared(node.children) }]
      : onlyShared(node.children),
  );
}

function MapsPage({ data, layout, player }: { data: Data; layout: Layout; player: boolean }) {
  const tree = player ? onlyShared(data.tree) : data.tree;
  const faces = (id: string) => data.faces[id] ?? [];
  const props = { tree, faces, player };
  return (
    <section aria-label="Maps page" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-serif text-3xl font-bold">Maps</h1>
        {!player && (
          <button type="button" className={primaryButtonClass}>
            New map
          </button>
        )}
      </div>
      <PartyLine data={data} />
      {layout === "tree" && <TreeLayout {...props} />}
      {layout === "cards" && <CardsLayout {...props} />}
      {layout === "atlas" && <AtlasLayout {...props} />}
    </section>
  );
}

interface LayoutProps {
  tree: Node[];
  faces: (id: string) => PartyFace[];
  player: boolean;
}

/** "Where the party is" on one line. */
function PartyLine({ data }: { data: Data }) {
  if (data.party.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className={labelClass}>Where the party is</span>
      {data.party.map((member) => (
        <span key={member.name} className="flex items-center gap-1.5">
          <Face face={member} />
          <span className="font-semibold">{member.name}</span>{" "}
          {member.map ? (
            <Link to={mapUrl(member.map.id)} className="text-link hover:underline">
              {member.map.name}
            </Link>
          ) : (
            <span className="text-muted">not on a map yet</span>
          )}
        </span>
      ))}
    </p>
  );
}

function Face({ face, size = 24 }: { face: PartyFace; size?: number }) {
  return face.portraitUrl ? (
    <img
      src={face.portraitUrl}
      alt={face.name}
      title={face.name}
      width={size}
      height={size}
      className="rounded-full border border-line object-cover object-top"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      title={face.name}
      className="flex items-center justify-center rounded-full border border-line bg-raised text-xs font-bold"
      style={{ width: size, height: size }}
    >
      {face.name.slice(0, 1)}
    </span>
  );
}

function Faces({ faces }: { faces: PartyFace[] }) {
  if (faces.length === 0) return null;
  return (
    <span className="flex -space-x-1.5" aria-label={`Here: ${faces.map((f) => f.name).join(", ")}`}>
      {faces.map((face) => (
        <Face key={face.name} face={face} size={22} />
      ))}
    </span>
  );
}

function Thumb({ map, className }: { map: Listed; className: string }) {
  return map.thumbnail ? (
    <img
      src={map.thumbnail}
      alt=""
      loading="lazy"
      className={`rounded-md border border-line bg-raised object-cover ${className}`}
    />
  ) : (
    <span
      className={`flex items-center justify-center rounded-md border border-dashed border-line bg-raised text-xs text-muted ${className}`}
    >
      No image
    </span>
  );
}

function EditLink({ map, player }: { map: Listed; player: boolean }) {
  if (player) return null;
  return (
    <Link
      to={mapEditUrl(map.id)}
      aria-label={`Edit ${map.name}`}
      className="text-xs text-muted hover:underline"
    >
      Edit
    </Link>
  );
}

function countMaps(nodes: Node[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countMaps(node.children), 0);
}

/** B: top-level maps with maps inside as big cards over their tree; maps on their own in a grid. */
function TreeLayout({ tree, faces, player }: LayoutProps) {
  const worlds = tree.filter((node) => node.children.length > 0);
  const alone = tree.filter((node) => node.children.length === 0);
  return (
    <nav aria-label="All maps" className="flex flex-col gap-4">
      {worlds.map((node) => (
        <div key={node.map.id} className={`${panelClass} flex flex-col gap-3`}>
          <div className="flex flex-wrap items-start gap-4">
            <Link to={mapUrl(node.map.id)} className="shrink-0">
              <Thumb map={node.map} className="aspect-video w-72" />
            </Link>
            <div className="flex flex-col gap-1">
              <Link
                to={mapUrl(node.map.id)}
                className="font-serif text-2xl font-bold hover:underline"
              >
                {node.map.name}
              </Link>
              <span className="text-xs text-muted">
                {countMaps(node.children)} maps inside
                {!player && ` · ${node.map.areas.length} areas`}
              </span>
              <Faces faces={faces(node.map.id)} />
              <EditLink map={node.map} player={player} />
            </div>
          </div>
          <TreeRows nodes={node.children} faces={faces} player={player} />
        </div>
      ))}
      {alone.length > 0 && (
        <section aria-label="Maps on their own" className="flex flex-col gap-2">
          {worlds.length > 0 && <h2 className={labelClass}>Maps on their own</h2>}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
            {alone.map((node) => (
              <Card key={node.map.id} map={node.map} faces={faces} player={player} />
            ))}
          </div>
        </section>
      )}
    </nav>
  );
}

function TreeRows({ nodes, faces, player }: Omit<LayoutProps, "tree"> & { nodes: Node[] }) {
  return (
    <ul className="flex flex-col gap-1 [&_ul]:mt-1 [&_ul]:ml-8 [&_ul]:border-l [&_ul]:border-line [&_ul]:pl-3">
      {nodes.map((node) => (
        <li key={node.map.id}>
          <div className="flex items-center gap-3 rounded-md px-1 py-1 hover:bg-raised">
            <Link to={mapUrl(node.map.id)} className="shrink-0" tabIndex={-1} aria-hidden>
              <Thumb map={node.map} className="aspect-video w-24" />
            </Link>
            <Link
              to={mapUrl(node.map.id)}
              className="font-serif text-lg font-semibold hover:underline"
            >
              {node.map.name}
            </Link>
            <Faces faces={faces(node.map.id)} />
            <span className="ml-auto">
              <EditLink map={node.map} player={player} />
            </span>
          </div>
          {node.children.length > 0 && (
            <TreeRows nodes={node.children} faces={faces} player={player} />
          )}
        </li>
      ))}
    </ul>
  );
}

function Card({
  map,
  faces,
  player,
  path,
}: {
  map: Listed;
  faces: (id: string) => PartyFace[];
  player: boolean;
  path?: string;
}) {
  return (
    <div className={`${panelClass} flex flex-col gap-2 p-2`}>
      <Link to={mapUrl(map.id)} tabIndex={-1} aria-hidden>
        <Thumb map={map} className="aspect-video w-full" />
      </Link>
      <div className="flex items-center gap-2 px-1">
        <Link to={mapUrl(map.id)} className="mr-auto font-serif font-semibold hover:underline">
          {map.name}
        </Link>
        <Faces faces={faces(map.id)} />
      </div>
      <div className="flex items-center gap-2 px-1 text-xs text-muted">
        <span className="mr-auto">{path}</span>
        <EditLink map={map} player={player} />
      </div>
    </div>
  );
}

/** A: every map as a card, depth first, with where it is written underneath. */
function CardsLayout({ tree, faces, player }: LayoutProps) {
  const flat: { map: Listed; path: string }[] = [];
  const walk = (nodes: Node[], path: string[]) => {
    for (const node of nodes) {
      flat.push({ map: node.map, path: path.join(" › ") });
      walk(node.children, [...path, node.map.name]);
    }
  };
  walk(tree, []);
  return (
    <nav
      aria-label="All maps"
      className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3"
    >
      {flat.map(({ map, path }) => (
        <Card key={map.id} map={map} faces={faces} player={player} path={path} />
      ))}
    </nav>
  );
}

/** C: one level at a time, world first. */
function AtlasLayout({ tree, faces, player }: LayoutProps) {
  const [trail, setTrail] = useState<Node[]>([]);
  const here = trail.at(-1);
  const shown = here ? here.children : tree;
  return (
    <nav aria-label="All maps" className="flex flex-col gap-3">
      <p className="flex flex-wrap gap-1 text-sm">
        <button type="button" className="text-link hover:underline" onClick={() => setTrail([])}>
          All maps
        </button>
        {trail.map((node, index) => (
          <span key={node.map.id}>
            ›{" "}
            <button
              type="button"
              className="text-link hover:underline"
              onClick={() => setTrail(trail.slice(0, index + 1))}
            >
              {node.map.name}
            </button>
          </span>
        ))}
      </p>
      {here && (
        <div className={`${panelClass} flex flex-wrap items-start gap-4`}>
          <Link to={mapUrl(here.map.id)}>
            <Thumb map={here.map} className="aspect-video w-96" />
          </Link>
          <div className="flex flex-col gap-1">
            <Link
              to={mapUrl(here.map.id)}
              className="font-serif text-2xl font-bold hover:underline"
            >
              Open {here.map.name}
            </Link>
            <Faces faces={faces(here.map.id)} />
            <EditLink map={here.map} player={player} />
          </div>
        </div>
      )}
      {here && <h2 className={labelClass}>Inside</h2>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {shown.map((node) => (
          <div key={node.map.id} className="flex flex-col">
            <Card map={node.map} faces={faces} player={player} />
            {node.children.length > 0 && (
              <button
                type="button"
                className="mt-1 self-start text-sm text-link hover:underline"
                onClick={() => setTrail([...trail, node])}
              >
                {countMaps(node.children)} maps inside ›
              </button>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}

/* Areas on a map */

function AreasOnAMap({
  data,
  view,
  style,
  player,
}: {
  data: Data;
  view: NonNullable<Data["view"]>;
  style: AreaStyle;
  player: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [highlight, setHighlight] = useState<string>();
  const [previewed, setPreviewed] = useState<string>();
  const [selected, setSelected] = useState<AreaView>();
  const areas = player ? view.areas.filter((area) => !area.secret) : view.areas;
  const faces = (id: string) => data.inside.find((badge) => badge.area === id)?.members ?? [];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;
      if (event.key.toLowerCase() === "p" && !event.ctrlKey && !event.metaKey) {
        setShowAll((on) => !on);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section aria-label="Areas on a map" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto font-serif text-2xl font-bold">{view.name}</h2>
        <span className="text-sm text-muted">
          Other map: add <code>?map=&lt;id&gt;</code>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={showAll}
          className={showAll ? primaryButtonClass : buttonClass}
          onClick={() => setShowAll(!showAll)}
        >
          Places (P)
        </button>
      </div>
      <div className="flex h-[70vh] gap-0 overflow-hidden rounded-lg border border-line">
        <MapCanvas
          name={view.name}
          size={view.size}
          imageUrl={view.image.url}
          className="flex-1"
          onCanvasClick={() => setPreviewed(undefined)}
        >
          {(canvas) => (
            <g aria-label="Map areas" role="group">
              {areas.map((area) => (
                <PrototypeArea
                  key={area.id}
                  area={area}
                  size={view.size}
                  scale={canvas.scale}
                  style={style}
                  lit={showAll || highlight === area.id}
                  plain={player}
                  faces={faces(area.id)}
                  previewed={previewed === area.id}
                  onPreview={(chosen) => setPreviewed(chosen.id)}
                  onSelect={setSelected}
                />
              ))}
            </g>
          )}
        </MapCanvas>
        <aside className="flex w-64 flex-col gap-2 overflow-y-auto border-l border-line bg-surface p-3">
          <h3 className={labelClass}>Areas</h3>
          <ul className="flex flex-col text-sm">
            {[...areas]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((area) => (
                <li
                  key={area.id}
                  onMouseEnter={() => setHighlight(area.id)}
                  onMouseLeave={() => setHighlight(undefined)}
                  onFocus={() => setHighlight(area.id)}
                  onBlur={() => setHighlight(undefined)}
                >
                  {area.map ? (
                    <Link
                      to={mapUrl(area.map.id)}
                      className="block rounded px-1 py-0.5 hover:bg-raised"
                    >
                      ▸ {area.name}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelected(area)}
                      className="block w-full rounded px-1 py-0.5 text-left text-muted hover:bg-raised"
                    >
                      {player ? "▸" : "◌"} {area.name}
                      {!player && <span className="text-xs"> (not mapped yet)</span>}
                    </button>
                  )}
                </li>
              ))}
          </ul>
          {selected && (
            <p className="rounded-md bg-raised p-2 text-sm">
              Selected: <strong>{selected.name}</strong> (the side panel would open here)
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
