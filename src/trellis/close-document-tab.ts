import type { TrellisController } from "./trellis-controller";

/**
 * ⌘W, as an editor's or a browser's: close the focused document tab (a
 * source, a preview or a Paper), else the active one, through Trellis as the
 * tab's own close button does, so App saves it and offers to reopen it. A
 * focused panel that is not a document (Project, the Agent) never closes this
 * way. False when no document tab is open, for the window to close instead.
 */
export function closeDocumentTab(controller: Pick<TrellisController, "ws" | "app" | "focusDocument">): boolean {
  const ws = controller.ws;
  if (ws && closePdfTab(controller)) return true;
  const files = ws?.views({ type: "file" }).filter((view) => view.placement !== "hidden") ?? [];
  if (!ws || files.length === 0) return false;
  const focused = ws.getSnapshot().focusedView;
  const key = controller.app.get().activeKey;
  const target = files.find((view) => view.id === focused) ?? files.find((view) => view.params.key === key) ?? files[0];
  void ws.close(target.id);
  return true;
}

/**
 * ⌘W on the PDF (focused, or the tab in front over the documents) puts it
 * away, hidden so it comes back where it was, and returns to the writing.
 */
function closePdfTab(controller: Pick<TrellisController, "ws" | "app" | "focusDocument">): boolean {
  const ws = controller.ws;
  const pdf = ws?.views({ type: "pdf" }).find((view) => view.placement === "docked");
  if (!ws || !pdf) return false;
  const key = controller.app.get().activeKey;
  const documents = ws.views({ type: "file" }).find((view) => view.params.key === key);
  const inFront = pdf.selected && documents?.panelId === pdf.panelId;
  if (ws.getSnapshot().focusedView !== pdf.id && !inFront) return false;
  ws.hide(pdf.id);
  if (key) controller.focusDocument(key);
  return true;
}
