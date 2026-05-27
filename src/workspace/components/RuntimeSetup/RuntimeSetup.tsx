import type { WorkspaceState } from '../../../shared/workspace-messages';

import styles from './RuntimeSetup.module.scss';

type RuntimeSetupProps = {
  workspace: WorkspaceState | undefined;
  onOpenExtensionDetails(): void;
};

export function RuntimeSetup({
  onOpenExtensionDetails,
  workspace,
}: RuntimeSetupProps) {
  if (workspace?.runtime.state !== 'user-scripts-unavailable') {
    return null;
  }

  return (
    <section className={styles.setup} aria-label="User Scripts setup">
      <div>
        <p>Setup needed</p>
        <h2>Enable User Scripts</h2>
        <span>
          Open Tampr's Chrome details, turn on Allow User Scripts, then reload
          this workspace.
        </span>
      </div>
      <button type="button" onClick={onOpenExtensionDetails}>
        Open extension details
      </button>
    </section>
  );
}
