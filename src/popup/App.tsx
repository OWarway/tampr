import { useState } from 'react';

import { startBlueprintCreator } from '../chrome/blueprints';
import { openWorkspace } from '../chrome/workspace';
import { openExtensionDetails } from '../chrome/extension-settings';
import {
  runtimeActionNotice,
  runtimeBadgeLabel,
} from '../shared/runtime-trust';
import type { PageState } from '../shared/workspace-messages';
import { usePageState, type PopupPageState } from './use-page-state';

import styles from './App.module.scss';

export function App() {
  const pageState = usePageState();
  const [blueprintNotice, setBlueprintNotice] = useState<string>();
  const canStartBlueprint = pageState.pageState.state === 'ready';

  async function startBlueprint(): Promise<void> {
    setBlueprintNotice('Pick an element on the page.');

    try {
      const response = await startBlueprintCreator();

      if (!response.ok) {
        setBlueprintNotice(response.error);
        return;
      }

      setBlueprintNotice(
        response.status === 'created'
          ? 'Blueprint created in the workspace.'
          : 'Blueprint cancelled.',
      );
    } catch (error: unknown) {
      setBlueprintNotice(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return (
    <main className={styles.popup}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img alt="" aria-hidden="true" src="/icons/tampr.svg" />
          <div>
            <p className={styles.label}>Current page</p>
            <h1>Tampr</h1>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.blueprintButton}
            disabled={!canStartBlueprint}
            type="button"
            onClick={() => void startBlueprint()}
          >
            Blueprint
          </button>
          <button type="button" onClick={() => void openWorkspace()}>
            Workspace
          </button>
        </div>
      </header>

      {blueprintNotice ? (
        <p className={styles.blueprintNotice}>{blueprintNotice}</p>
      ) : null}

      <PageStatus
        busySnippetId={pageState.busySnippetId}
        pageState={pageState.pageState}
        onOpenExtensionDetails={() => void openExtensionDetails()}
        onSetSnippetEnabled={(snippetId, enabled) =>
          void pageState.setSnippetEnabled(snippetId, enabled)
        }
      />
    </main>
  );
}

type PageStatusProps = {
  busySnippetId: string | undefined;
  pageState: PopupPageState;
  onOpenExtensionDetails(): void;
  onSetSnippetEnabled(snippetId: string, enabled: boolean): void;
};

function PageStatus({
  busySnippetId,
  onOpenExtensionDetails,
  onSetSnippetEnabled,
  pageState,
}: PageStatusProps) {
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

  return (
    <ReadyPageStatus
      busySnippetId={busySnippetId}
      onOpenExtensionDetails={onOpenExtensionDetails}
      page={pageState.page}
      onSetSnippetEnabled={onSetSnippetEnabled}
    />
  );
}

type ReadyPageStatusProps = {
  busySnippetId: string | undefined;
  onOpenExtensionDetails(): void;
  page: PageState;
  onSetSnippetEnabled(snippetId: string, enabled: boolean): void;
};

function ReadyPageStatus({
  busySnippetId,
  onOpenExtensionDetails,
  onSetSnippetEnabled,
  page,
}: ReadyPageStatusProps) {
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
              <div>
                <strong>{match.name}</strong>
                <span>{match.rule}</span>
              </div>
              <button
                className={styles.snippetToggle}
                disabled={busySnippetId === match.id}
                type="button"
                onClick={() => onSetSnippetEnabled(match.id, !match.enabled)}
              >
                {match.enabled ? 'Disable' : 'Enable'}
              </button>
            </li>
          ))}
        </ol>
      )}

      {runtimeBlocked || blockedMatches[0] ? (
        <p className={styles.runtimeNote}>
          {runtimeActionNotice(page.runtime, blockedMatches[0]?.skip?.reason)}
        </p>
      ) : null}

      {page.runtime.state === 'user-scripts-unavailable' ? (
        <button
          className={styles.setupButton}
          type="button"
          onClick={onOpenExtensionDetails}
        >
          Open extension details
        </button>
      ) : null}
    </section>
  );
}

function runtimeBadge(page: PageState): string {
  return runtimeBadgeLabel(page.runtime);
}
