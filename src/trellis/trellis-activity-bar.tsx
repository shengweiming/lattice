/**
 * The activity bar: a VS Code-style strip of icons down the window's left
 * edge, one per sidebar view (Files, Papers, Agent). The three share one
 * sidebar panel (see `defaultLayout`), so choosing an icon brings its view
 * forward in that panel; choosing the icon of the view already on screen
 * hides the sidebar, and choosing any icon again brings it back.
 */
import { useCallback, useSyncExternalStore } from "react";
import { useLingui } from "@lingui/react/macro";
import { Bot, Files, Library } from "lucide-react";
import { Tip } from "../components/icon-tip";
import { agentEntryProps } from "../agent/agent-entry";
import type { TrellisController, TrellisSingleton } from "./trellis-controller";
import { PANEL_TITLES } from "./trellis-titles";

const ACTIVITIES = [
  { kind: "project", icon: <Files size={22} strokeWidth={1.5} /> },
  { kind: "papers", icon: <Library size={22} strokeWidth={1.5} /> },
  { kind: "agent", icon: <Bot size={22} strokeWidth={1.5} /> },
] as const satisfies ReadonlyArray<{ kind: TrellisSingleton; icon: unknown }>;

/** The views the activity bar switches between, in its order. */
export const ACTIVITY_KINDS = ACTIVITIES.map(({ kind }) => kind);

/**
 * Hide the whole panel `kind` sits in (every view tabbed beside it), not
 * just its tab, the way choosing the active view in VS Code's activity bar
 * closes the sidebar. The panel keeps its views; `showPanel` brings it back.
 */
function hideSidebar(controller: TrellisController, kind: TrellisSingleton) {
  const view = controller.ws?.view(kind);
  if (view && view.placement !== "hidden") controller.ws?.hide(view.panelId);
}

/** Choose a sidebar view's icon (also ⌘1 to ⌘3): show the view, or hide the sidebar when it is already in front. */
export function toggleActivity(controller: TrellisController, kind: TrellisSingleton) {
  if (controller.panelOnScreen(kind)) hideSidebar(controller, kind);
  else controller.showPanel(kind);
}

export function ActivityBar({ controller }: { controller: TrellisController }) {
  const { i18n, t } = useLingui();
  const subscribe = useCallback((listener: () => void) => {
    const offUi = controller.ui.subscribe(listener);
    const offWorkspace = controller.subscribeWorkspace(listener);
    return () => { offUi(); offWorkspace(); };
  }, [controller]);
  // A string, so an unchanged answer does not re-render.
  const onScreen = useSyncExternalStore(subscribe, () => ACTIVITIES.map(({ kind }) => (controller.panelOnScreen(kind) ? "1" : "0")).join(""));
  return (
    <nav className="activity-bar" aria-label={t`Sidebar views`}>
      {ACTIVITIES.map(({ kind, icon }, index) => {
        const active = onScreen[index] === "1";
        const title = i18n._(PANEL_TITLES[kind]);
        const shortcut = controller.bridge?.shortcut(`panel-${kind}`) ?? undefined;
        return (
          <Tip key={kind} label={title} shortcut={shortcut} side="right">
            <button
              type="button"
              className="activity-bar-item"
              data-active={active || undefined}
              aria-label={title}
              aria-pressed={active}
              onClick={() => toggleActivity(controller, kind)}
              {...(kind === "agent" ? agentEntryProps : {})}
            >
              {icon}
            </button>
          </Tip>
        );
      })}
    </nav>
  );
}
