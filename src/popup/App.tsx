import { openWorkspace } from '../chrome/workspace';

import styles from './App.module.scss';

export function App() {
  return (
    <main className={styles.popup}>
      <header className={styles.header}>
        <div>
          <p className={styles.label}>Current page</p>
          <h1>Tampr</h1>
        </div>
        <button type="button" onClick={() => void openWorkspace()}>
          Workspace
        </button>
      </header>

      <section className={styles.status} aria-label="Page snippets">
        <div className={styles.statusRow}>
          <strong>No snippets active</strong>
          <span>Ready</span>
        </div>
        <p>Nothing matches this page yet.</p>
      </section>
    </main>
  );
}
