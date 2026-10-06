import { useEffect, type ReactNode } from "react";
import { rememberedPanel, SidePanel, type SidePanelTab } from "./SidePanel";

type Tab = "map" | "tokens" | "fight";

const TABS: Record<Tab | "fog", SidePanelTab<Tab | "fog">> = {
  map: { key: "map", label: "Map", icon: "▦" },
  tokens: { key: "tokens", label: "Tokens", icon: "◉" },
  fight: { key: "fight", label: "Fight", icon: "⚔" },
  fog: { key: "fog", label: "Fog", icon: "☁" },
};

/** What the DM last had open, kept in their browser only. */
const panel = rememberedPanel<Tab>("guildhall.dmMapPanel", ["map", "tokens", "fight"], "map");

/**
 * The DM's side panel on a map: the map's own details (its note and areas) and its Tokens, with
 * the fight's tracker in a tab of its own while the fight is open here. Fog takes over the panel
 * while it's on, since it changes what clicks on the map do. There's room for more tabs (such as
 * handouts) beside these.
 */
export function DmSidePanel({
  fight,
  fog,
  map,
  tokens,
  showTokens,
}: {
  /** The tracker, while the fight is open on this map. */
  fight?: ReactNode;
  /** The fog tools' list, while they're on. */
  fog?: ReactNode;
  map: ReactNode;
  tokens: ReactNode;
  /** Bumped to open the Tokens tab, such as when a token is chosen on the map. */
  showTokens?: number;
}) {
  const state = panel.use();
  const open = (tab: Tab) => panel.remember({ tab, folded: false });

  // Opening the fight shows the tracker; closing it goes back to the tokens.
  const fighting = !!fight;
  useEffect(() => {
    const now = panel.current();
    if (fighting) panel.remember({ tab: "fight", folded: now.folded });
    else if (now.tab === "fight") panel.remember({ tab: "tokens", folded: now.folded });
  }, [fighting]);

  useEffect(() => {
    if (showTokens) panel.remember({ tab: "tokens", folded: false });
  }, [showTokens]);

  if (fog) {
    return (
      <SidePanel
        label="Map details"
        tabs={[TABS.fog]}
        tab="fog"
        folded={state.folded}
        onOpen={() => panel.remember({ tab: state.tab, folded: false })}
        onFold={() => panel.remember({ tab: state.tab, folded: true })}
      >
        {fog}
      </SidePanel>
    );
  }

  const tab = state.tab === "fight" && !fight ? "tokens" : state.tab;
  const tabs = [TABS.map, TABS.tokens, ...(fight ? [TABS.fight] : [])] as SidePanelTab<Tab>[];
  return (
    <SidePanel
      label="Map details"
      tabs={tabs}
      tab={tab}
      folded={state.folded}
      onOpen={open}
      onFold={() => panel.remember({ tab, folded: true })}
    >
      {tab === "map" ? map : tab === "tokens" ? tokens : fight}
    </SidePanel>
  );
}
