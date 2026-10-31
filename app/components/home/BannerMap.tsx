import { Link } from "react-router";
import type { Banner } from "~/home/front-page";
import type { PartyFace } from "~/maps/tokens/types";

/**
 * The map where the party is, at its own shape, with their faces where their tokens are. Drawn
 * over map art, so its colours are the same in every theme.
 */
export function BannerMap({ banner }: { banner: Banner }) {
  return (
    <Link
      to={banner.url}
      aria-label={`Open ${banner.name}`}
      className="gh-hero-map group relative block self-center overflow-hidden rounded-xl border-4 border-stone-50/80 bg-stone-950 shadow-2xl transition-transform hover:-translate-y-0.5"
      style={{ aspectRatio: `${banner.size.width / banner.size.height}` }}
    >
      {banner.thumbnail && (
        <img
          src={banner.thumbnail}
          alt=""
          className="absolute inset-0 size-full transition-transform duration-700 group-hover:scale-[1.03]"
        />
      )}
      <ul aria-label="The party here">
        {banner.faces.map((face) => (
          <li
            key={face.name}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${face.at[0] * 100}%`, top: `${face.at[1] * 100}%` }}
          >
            <span className="absolute inset-0 rounded-full bg-amber-200/60 motion-safe:animate-ping" />
            <Face face={face} />
          </li>
        ))}
      </ul>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pt-8 pb-3 font-display text-lg text-white">
        {banner.name}
        <span className="ml-2 text-sm text-white/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Open the map →
        </span>
      </span>
    </Link>
  );
}

const SIZE = 34;

function Face({ face }: { face: PartyFace }) {
  const shape = "relative rounded-full border-2 border-stone-50 shadow-lg";
  return face.portraitUrl ? (
    <img
      src={face.portraitUrl}
      alt={face.name}
      title={face.name}
      className={`${shape} object-cover object-top`}
      style={{ width: SIZE, height: SIZE }}
    />
  ) : (
    <span
      role="img"
      aria-label={face.name}
      title={face.name}
      className={`${shape} flex items-center justify-center bg-stone-700 font-display font-bold text-white`}
      style={{ width: SIZE, height: SIZE, fontSize: SIZE * 0.4 }}
    >
      {face.name.charAt(0).toUpperCase()}
    </span>
  );
}
