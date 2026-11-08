/**
 * Titlebar controls for the Trellis workspace. (This fork drops the Panels
 * menu and the workspace switch: the activity bar switches the sidebar, and
 * focus mode is a button among the canvas tools.) In the middle, the command
 * palette's search field. On the right, beside the canvas tools, a chip per
 * hidden panel. The PDF also comes up from each .tex panel's Build button.
 * Eager but light: it drives the workspace only through the controller.
 */
import { memo, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { useLingui } from "@lingui/react/macro";
import { Search } from "lucide-react";
import { Tip } from "../components/icon-tip";
import { Keycaps } from "../components/ui/keycaps";
import { agentEntryProps } from "../agent/agent-entry";
import { useWorkspaces, type TrellisController } from "./trellis-controller";
import { spaceMixedScript } from "./trellis-titles";
import { ACTIVITY_KINDS } from "./trellis-activity-bar";

/**
 * How many of the titlebar's folds it needs: `steps` of them, in order, each
 * taken only when the controls, laid out with the folds before it, would not
 * fit the room the titlebar has (what the window leaves beside the canvas
 * tools). With the search field, the first fold shrinks it to its icon and the
 * second folds the layout switch's workspaces into a menu; without it, that is
 * the only fold. So the answer follows the window, those tools and the
 * language's and the workspaces' name lengths rather than a fixed window
 * width. The hidden panels' chips count as content to fit, since they shrink
 * before anything else would overflow and a restore chip clipped to nothing is
 * lost: both the row's own overflow and each chip squeezed below its own width
 * cap.
 *
 * Each fold keeps what the controls needed without it, and is undone only
 * once the room holds that need again, so a fold cannot oscillate. `content`
 * names what changes that need (the language, the names, the chips), which
 * re-measures it unfolded.
 */
function useFolds(barRef: RefObject<HTMLDivElement | null>, chipsRef: RefObject<HTMLDivElement | null>, content: string, steps: number) {
  // A fit belongs to the content it was measured with: new content starts
  // unfolded, and is measured that way before it paints (a layout effect).
  // `needs[i]` is what the controls asked for with `i` folds.
  const [fit, setFit] = useState<{ content: string; needs: readonly number[] }>({ content, needs: [] });
  const folds = fit.content === content ? Math.min(fit.needs.length, steps) : 0;
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const needs = fit.content === content ? fit.needs.slice(0, steps) : [];
    const unfoldAt = needs.at(-1) ?? 0;
    const measure = () => {
      const room = bar.clientWidth;
      if (folds > 0 && room >= unfoldAt) {
        setFit({ content, needs: needs.slice(0, -1) });
      } else if (folds < steps) {
        const need = controlsDemand(bar, chipsRef.current);
        if (need > room + 0.5) setFit({ content, needs: [...needs, need] });
      }
    };
    // The bar's own size is the room; its controls' sizes change with what
    // they hold (a web font arriving, a chip's title) without changing it.
    // An observer reports each target once on observe, which measures now.
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    for (const control of bar.children) observer.observe(control);
    return () => observer.disconnect();
  }, [barRef, chipsRef, content, fit, folds, steps]);
  return folds;
}

/**
 * Centres the search field on the window, not on the gap the controls either
 * side leave it: Panels and the workspaces stand on its left and at most the
 * hidden panels' chips on its right, so the gap's middle sits right of the
 * window's. It moves only as far as its margins in that gap reach, so it
 * never covers a control.
 */
function useWindowCentred(barRef: RefObject<HTMLDivElement | null>, fieldRef: RefObject<HTMLButtonElement | null>, active: boolean, layout: string) {
  useLayoutEffect(() => {
    const bar = barRef.current;
    const field = fieldRef.current;
    if (!bar || !field || !active || typeof ResizeObserver === "undefined") return;
    let shift = 0;
    const place = () => {
      // Where the field's layout put it: the measured box minus the shift.
      const box = field.getBoundingClientRect();
      const left = box.left - shift;
      const right = box.right - shift;
      const style = getComputedStyle(bar);
      const gap = Number.parseFloat(style.columnGap) || 0;
      const barBox = bar.getBoundingClientRect();
      let from = barBox.left + (Number.parseFloat(style.paddingLeft) || 0);
      let to = barBox.right - (Number.parseFloat(style.paddingRight) || 0);
      for (const control of bar.children) {
        const rect = control.getBoundingClientRect();
        if (control === field || rect.width === 0) continue;
        if (rect.right <= left) from = Math.max(from, rect.right + gap);
        else to = Math.min(to, rect.left - gap);
      }
      const view = (bar.closest(".titlebar") ?? document.documentElement).getBoundingClientRect();
      const wanted = (view.left + view.right) / 2 - (left + right) / 2;
      const next = Math.round(Math.min(Math.max(wanted, Math.min(0, from - left)), Math.max(0, to - right)));
      if (next === shift) return;
      shift = next;
      field.style.translate = shift ? `${shift}px` : "";
    };
    // The bar moves with the project name and the canvas tools beside it,
    // which resize it; its controls resize with what they hold.
    const observer = new ResizeObserver(place);
    observer.observe(bar);
    for (const control of bar.children) observer.observe(control);
    return () => {
      observer.disconnect();
      field.style.translate = "";
    };
  }, [barRef, fieldRef, active, layout]);
}

/**
 * How wide the titlebar's controls ask to be, as laid out now. The bar is a
 * flex row as wide as its room, so its scrollWidth never reads less than that
 * room however empty the row is: the controls use up to where the last of
 * them ends, or past the room when they overflow it. A restore chip ends in
 * an ellipsis at its own width cap whatever the room, so only what the row
 * squeezed it below that cap (or the chips' row clipped) is room missing.
 */
function controlsDemand(bar: HTMLElement, chips: HTMLElement | null): number {
  const box = bar.getBoundingClientRect();
  let end = box.left;
  for (const control of bar.children) {
    const rect = control.getBoundingClientRect();
    if (rect.width > 0) end = Math.max(end, rect.right);
  }
  const contentEnd = box.right - bar.clientLeft - (Number.parseFloat(getComputedStyle(bar).paddingRight) || 0);
  let need = bar.scrollWidth - Math.max(0, contentEnd - end);
  if (!chips) return need;
  need += Math.max(0, chips.scrollWidth - chips.clientWidth);
  for (const chip of chips.children) {
    if (!(chip instanceof HTMLElement)) continue;
    const full = chip.scrollWidth + chip.offsetWidth - chip.clientWidth;
    const cap = Number.parseFloat(getComputedStyle(chip).maxWidth);
    const squeezed = Math.min(full, Number.isNaN(cap) ? full : cap) - chip.getBoundingClientRect().width;
    // scrollWidth is whole pixels: a fraction short is rounding, not a cut title.
    if (squeezed >= 1) need += squeezed;
  }
  return need;
}

/** Memoized: App re-renders per keystroke and these controls only follow the workspace. */
export const TrellisTitlebar = memo(function TrellisTitlebar({ controller, onSearch, searchShortcut }: {
  controller: TrellisController;
  /** Opens the command palette, from the search field in the bar's middle (none without it). */
  onSearch?: () => void;
  /** The palette's key, drawn in the field ("⌘K"). */
  searchShortcut?: string;
}) {
  const { t, i18n } = useLingui();
  const allHidden = useSyncExternalStore(controller.ui.subscribe, () => controller.ui.get().hidden);
  // The sidebar panel (Files, Papers, Agent) comes back through the activity
  // bar's icons, so it gets no restore chip here.
  const sidebarPanels = new Set(ACTIVITY_KINDS.map((kind) => controller.ws?.view(kind)?.panelId));
  const hidden = allHidden.filter((entry) => !sidebarPanels.has(entry.panelId));
  const workspaces = useWorkspaces(controller);
  const ws = () => controller.ws;
  const barRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLButtonElement>(null);
  // The workspaces' names are content to fit as much as the chips are; their
  // order is not (a move must not unfold the switch and remount its open menu).
  const content = [i18n.locale, ...workspaces.map((entry) => entry.name).sort(), "", ...hidden.map((entry) => entry.title)].join("\n");
  const folds = useFolds(barRef, chipsRef, content, onSearch ? 2 : 1);
  const searchFolded = Boolean(onSearch) && folds >= 1;
  const compact = folds >= (onSearch ? 2 : 1);
  useWindowCentred(barRef, searchRef, Boolean(onSearch) && !searchFolded, `${content}\n${hidden.length}`);
  const searchLabel = t`Search files, papers and commands`;
  return (
    <div ref={barRef} className="trellis-titlebar" data-compact={compact || undefined} data-search-folded={searchFolded || undefined}>
      {onSearch && (
        // Folded to its icon, the field names itself in a tooltip; in full,
        // its placeholder already does.
        <Tip label={searchFolded ? searchLabel : null} shortcut={searchShortcut}>
          <button
            ref={searchRef}
            type="button"
            className="trellis-titlebar-search"
            aria-label={searchLabel}
            aria-haspopup="dialog"
            onClick={onSearch}
          >
            <Search size={14} aria-hidden="true" />
            <span className="trellis-titlebar-search-label">{t`Search`}</span>
            {searchShortcut && <Keycaps keys={[searchShortcut]} className="trellis-titlebar-search-keys" />}
          </button>
        </Tip>
      )}
      {hidden.length > 0 && (
        <div ref={chipsRef} className="trellis-titlebar-hidden" aria-label={t`Hidden panels`}>
          {hidden.map((entry) => (
            <Tip key={entry.panelId} label={spaceMixedScript(t`Restore ${entry.title}`)}>
              <button
                type="button"
                className="trellis-hidden-chip"
                onClick={() => ws()?.restore(entry.panelId)}
                {...(ws()?.view("agent")?.panelId === entry.panelId ? agentEntryProps : {})}
              >
                {entry.title}
              </button>
            </Tip>
          ))}
        </div>
      )}
    </div>
  );
});
