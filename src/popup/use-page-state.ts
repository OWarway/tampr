import { useEffect, useState } from 'react';

import { getActivePageUrl } from '../chrome/active-page';
import { getPageState } from '../chrome/page-state';
import { setSnippetEnabled as setStoredSnippetEnabled } from '../chrome/snippet-actions';
import type { PageState } from '../shared/workspace-messages';

export type PopupPageState =
  | {
      state: 'loading';
    }
  | {
      state: 'unsupported-page';
    }
  | {
      state: 'ready';
      page: PageState;
    }
  | {
      state: 'error';
      message: string;
    };

export type UsePageStateResult = {
  busySnippetId: string | undefined;
  pageState: PopupPageState;
  setSnippetEnabled(snippetId: string, enabled: boolean): Promise<void>;
};

export function usePageState(): UsePageStateResult {
  const [busySnippetId, setBusySnippetId] = useState<string>();
  const [pageState, setPageState] = useState<PopupPageState>({
    state: 'loading',
  });

  useEffect(() => {
    let active = true;

    void loadPageState().then((nextState) => {
      if (active) {
        setPageState(nextState);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function setSnippetEnabled(
    snippetId: string,
    enabled: boolean,
  ): Promise<void> {
    if (pageState.state !== 'ready') {
      return;
    }

    setBusySnippetId(snippetId);

    try {
      await setStoredSnippetEnabled(snippetId, enabled);
      setPageState({
        state: 'ready',
        page: await getPageState(pageState.page.pageUrl),
      });
    } catch (error: unknown) {
      setPageState({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusySnippetId(undefined);
    }
  }

  return {
    busySnippetId,
    pageState,
    setSnippetEnabled,
  };
}

async function loadPageState(): Promise<PopupPageState> {
  try {
    const pageUrl = await getActivePageUrl();

    if (!pageUrl) {
      return { state: 'unsupported-page' };
    }

    return {
      state: 'ready',
      page: await getPageState(pageUrl),
    };
  } catch (error: unknown) {
    return {
      state: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
