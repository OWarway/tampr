import { useEffect, useState } from 'react';

import { getActivePageUrl } from '../chrome/active-page';
import { getPageState } from '../chrome/page-state';
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

export function usePageState(): PopupPageState {
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

  return pageState;
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
