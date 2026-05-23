import type { WorkspaceState } from '../../../shared/workspace-messages';
import { workspaceTrustItems } from '../../../shared/runtime-trust';

import styles from './TrustStrip.module.scss';

type TrustStripProps = {
  workspace: WorkspaceState | undefined;
};

export function TrustStrip({ workspace }: TrustStripProps) {
  return (
    <section className={styles.strip} aria-label="Trust status">
      {workspaceTrustItems(workspace).map((item) => (
        <article
          className={`${styles.item} ${styles[item.tone]}`}
          key={item.id}
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.detail}</p>
        </article>
      ))}
    </section>
  );
}
