import { openWorkspace } from '../chrome/workspace';
import type { PageState } from '../shared/workspace-messages';
import { usePageState, type PopupPageState } from './use-page-state';

import styles from './App.module.scss';

export function App() {
  const pageState = usePageState();

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

      <PageStatus pageState={pageState} />
    </main>
  );
}

function PageStatus({ pageState }: { pageState: PopupPageState }) {
  if (pageState.state === 'loading') {
    return (
      <section className={styles.status} aria-label="Page snippets">
        <div className={styles.statusRow}>
          <strong>Reading page state</strong>
          <span>Loading</span>
        </div>
      </section>
    );
  }

  if (pageState.state === 'unsupported-page') {
    return (
      <section className={styles.status} aria-label="Page snippets">
        <div className={styles.statusRow}>
          <strong>Web page needed</strong>
          <span>Idle</span>
        </div>
        <p>Tampr runs local snippets on http and https pages.</p>
      </section>
    );
  }

  if (pageState.state === 'error') {
    return (
      <section className={styles.status} aria-label="Page snippets">
        <div className={styles.statusRow}>
          <strong>Page state unavailable</strong>
          <span>Error</span>
        </div>
        <p>{pageState.message}</p>
      </section>
    );
  }

  return <ReadyPageStatus page={pageState.page} />;
}

function ReadyPageStatus({ page }: { page: PageState }) {
  const blockedMatches = page.enabledMatches
    .map((match) => ({
      match,
      skip: page.runtime.skipped.find((skip) => skip.snippetId === match.id),
    }))
    .filter(({ skip }) => skip !== undefined);
  const runtimeBlocked = page.runtime.state !== 'ready';
  const activeCount = runtimeBlocked
    ? 0
    : page.enabledMatches.length - blockedMatches.length;
  const headline =
    activeCount === 0
      ? 'No snippets active'
      : `${activeCount} active ${activeCount === 1 ? 'snippet' : 'snippets'}`;

  return (
    <section className={styles.status} aria-label="Page snippets">
      <div className={styles.statusRow}>
        <strong>{headline}</strong>
        <span>{runtimeBadge(page)}</span>
      </div>

      {page.savedMatches.length === 0 ? (
        <p>Nothing matches this page yet.</p>
      ) : (
        <ol className={styles.snippets}>
          {page.savedMatches.slice(0, 3).map((match) => (
            <li key={match.id}>
              <strong>{match.name}</strong>
              <span>{match.rule}</span>
            </li>
          ))}
        </ol>
      )}

      {runtimeBlocked || blockedMatches[0] ? (
        <p className={styles.runtimeNote}>
          {runtimeBlockNotice(page, blockedMatches[0]?.skip?.reason)}
        </p>
      ) : null}
    </section>
  );
}

function runtimeBadge(page: PageState): string {
  if (page.runtime.state === 'user-scripts-unavailable') {
    return 'Unavailable';
  }

  return page.runtime.state === 'sync-error' ? 'Error' : 'Ready';
}

function runtimeBlockNotice(
  page: PageState,
  skipReason?: PageState['runtime']['skipped'][number]['reason'],
): string {
  if (page.runtime.state === 'user-scripts-unavailable') {
    return 'Enable User Scripts for Tampr before matches can run.';
  }

  if (page.runtime.state === 'sync-error') {
    return 'A runtime sync error blocks a matching snippet.';
  }

  if (skipReason === 'host-access') {
    return 'Host access is still needed for a matching snippet.';
  }

  if (skipReason === 'no-code') {
    return 'A matching snippet has no CSS or JavaScript yet.';
  }

  return 'A matching snippet is disabled or cannot be registered.';
}
