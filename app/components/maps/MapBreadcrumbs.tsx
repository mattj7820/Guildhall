import { Link } from "react-router";
import type { MapLink } from "~/maps/types";
import { mapUrl } from "~/maps/urls";

/** Where this map sits: every map above it, each a way back up, then this one. */
export function MapBreadcrumbs({ crumbs, suffix }: { crumbs: MapLink[]; suffix?: string }) {
  return (
    <nav aria-label="Breadcrumbs" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-1.5 text-muted">
        <li>
          <Link to="/maps" className="hover:underline">
            Maps
          </Link>
        </li>
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;
          return (
            <li key={crumb.id} className="flex items-center gap-x-1.5">
              <span aria-hidden="true">›</span>
              {isCurrent ? (
                <span aria-current="page" className="font-semibold text-ink">
                  {crumb.name}
                  {suffix}
                </span>
              ) : (
                <Link to={mapUrl(crumb.id)} className="hover:underline">
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
