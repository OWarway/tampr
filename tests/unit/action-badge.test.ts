import { describe, expect, it } from 'vitest';

import {
  ActionBadgeController,
  type ActionBadgeApi,
  type BadgeTabsApi,
} from '../../src/background/action-badge';
import { TAMPR_BADGE_HIT_MESSAGE } from '../../src/shared/tampr-api';

describe('ActionBadgeController', () => {
  it('dedupes snippet hits and shows the per-tab active count', async () => {
    const action = new MemoryActionBadgeApi();
    const controller = new ActionBadgeController(action);

    await controller.handleBadgeHitMessage(createHit('one'), {
      tab: { id: 7 },
    });
    await controller.handleBadgeHitMessage(createHit('one'), {
      tab: { id: 7 },
    });
    await controller.handleBadgeHitMessage(createHit('two'), {
      tab: { id: 7 },
    });

    expect(action.texts.at(-1)).toEqual({ tabId: 7, text: '2' });
    expect(action.titles.at(-1)).toEqual({
      tabId: 7,
      title: 'Tampr: 2 active snippets',
    });
  });

  it('clears a tab badge when the tab starts loading a new page', async () => {
    const action = new MemoryActionBadgeApi();
    const tabs = new MemoryTabsApi();
    const controller = new ActionBadgeController(action);
    controller.installTabListeners(tabs);

    await controller.handleBadgeHitMessage(createHit('one'), {
      tab: { id: 7 },
    });
    tabs.update(7, { status: 'loading' });

    expect(action.texts.at(-1)).toEqual({ tabId: 7, text: '' });
    expect(action.titles.at(-1)).toEqual({ tabId: 7, title: 'Tampr' });
  });

  it('rejects badge hits without a sender tab', async () => {
    const controller = new ActionBadgeController(new MemoryActionBadgeApi());

    await expect(
      controller.handleBadgeHitMessage(createHit('one'), {}),
    ).resolves.toEqual({
      ok: false,
      error: 'Tampr badge request is missing a tab.',
    });
  });

  it('caps large badge counts so the extension bar stays readable', async () => {
    const action = new MemoryActionBadgeApi();
    const controller = new ActionBadgeController(action);

    for (let index = 0; index < 105; index += 1) {
      await controller.handleBadgeHitMessage(createHit(`snippet-${index}`), {
        tab: { id: 7 },
      });
    }

    expect(action.texts.at(-1)).toEqual({ tabId: 7, text: '99+' });
  });
});

function createHit(snippetId: string) {
  return {
    type: TAMPR_BADGE_HIT_MESSAGE,
    snippetId,
  };
}

class MemoryActionBadgeApi implements ActionBadgeApi {
  public readonly backgrounds: Array<{ color: string; tabId?: number }> = [];
  public readonly texts: Array<{ tabId?: number; text: string }> = [];
  public readonly titles: Array<{ tabId?: number; title: string }> = [];

  setBadgeBackgroundColor(details: { color: string; tabId?: number }): void {
    this.backgrounds.push(details);
  }

  setBadgeText(details: { tabId?: number; text: string }): void {
    this.texts.push(details);
  }

  setTitle(details: { tabId?: number; title: string }): void {
    this.titles.push(details);
  }
}

class MemoryTabsApi implements BadgeTabsApi {
  private updateListener:
    | ((tabId: number, changeInfo: { status?: string; url?: string }) => void)
    | undefined;

  public readonly onUpdated = {
    addListener: (
      listener: (
        tabId: number,
        changeInfo: { status?: string; url?: string },
      ) => void,
    ) => {
      this.updateListener = listener;
    },
  };

  update(tabId: number, changeInfo: { status?: string; url?: string }): void {
    this.updateListener?.(tabId, changeInfo);
  }
}
