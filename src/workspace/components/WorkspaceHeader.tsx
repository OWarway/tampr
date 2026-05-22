import { runtimeLabel } from '../runtime-copy';
import type { WorkspaceState } from '../../shared/workspace-messages';

type WorkspaceHeaderProps = {
  workspace: WorkspaceState | undefined;
};

export function WorkspaceHeader({ workspace }: WorkspaceHeaderProps) {
  return (
    <header className="workspace__header">
      <div>
        <p>Tampr</p>
        <h1>Workspace</h1>
      </div>
      <span>{runtimeLabel(workspace)}</span>
    </header>
  );
}
