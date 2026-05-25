import type { ReactNode } from 'react';

import type { WorkspaceState } from '../../../shared/workspace-messages';
import { runtimeLabel } from '../../runtime-copy';

import styles from './WorkspaceHeader.module.scss';

type WorkspaceHeaderProps = {
  actions?: ReactNode;
  workspace: WorkspaceState | undefined;
};

export function WorkspaceHeader({ actions, workspace }: WorkspaceHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img alt="" aria-hidden="true" src="/icons/tampr.svg" />
        <div>
          <p>Tampr</p>
          <h1>Workspace</h1>
        </div>
      </div>
      <div className={styles.meta}>
        <span className={styles.status}>{runtimeLabel(workspace)}</span>
        {actions}
      </div>
    </header>
  );
}
