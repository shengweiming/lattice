/**
 * The workbench: the activity bar down the window's left edge, beside the
 * Trellis workspace and whatever App mounts into it (the panel portals, the
 * document surfaces, Get started). The workspace renders behind a ChunkGate,
 * so a project's first frame shows as soon as its chunks are in, with no
 * Suspense reveal to wait out.
 */
import { Suspense, type ReactNode } from "react";
import { ChunkGate } from "../components/chunk-gate";
import { lazyChunk } from "../lib/lazy-chunk";
import { ActivityBar } from "../trellis/trellis-activity-bar";
import type { TrellisController } from "../trellis/trellis-controller";
import { loadTrellisWorkspace } from "./workspace-chunks";

// The workspace (and the Trellis library) load after the eager startup chunks.
const TrellisWorkspace = lazyChunk(loadTrellisWorkspace, (module) => module.default);

export function AppWorkbench({ controller, projectRoot, dark, focusMode, loading, children }: {
  controller: TrellisController;
  projectRoot: string;
  dark: boolean;
  focusMode: boolean;
  /** Shown until the workspace's chunk is in. */
  loading: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="workbench-row">
      {!focusMode && <ActivityBar controller={controller} />}
      <main className="workspace trellis-workspace">
        <ChunkGate chunk={loadTrellisWorkspace} fallback={loading}>
          <Suspense fallback={loading}>
            <TrellisWorkspace key={projectRoot} controller={controller} projectRoot={projectRoot} dark={dark} focusMode={focusMode} />
          </Suspense>
        </ChunkGate>
        {children}
      </main>
    </div>
  );
}
