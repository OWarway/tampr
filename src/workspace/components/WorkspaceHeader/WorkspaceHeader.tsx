import type { WorkspaceState } from '../../../shared/workspace-messages';
import { runtimeLabel } from '../../runtime-copy';

import styles from './WorkspaceHeader.module.scss';

type WorkspaceHeaderProps = {
  workspace: WorkspaceState | undefined;
};

export function WorkspaceHeader({ workspace }: WorkspaceHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <p>Tampr</p>
        <h1>Workspace</h1>
      </div>
      <span className={styles.status}>{runtimeLabel(workspace)}</span>
    </header>
  );
}
