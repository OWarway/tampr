import { z } from 'zod';

import { SnippetIdSchema } from '../domain/snippets';
import {
  TAMPR_BADGE_HIT_MESSAGE,
  type TamprBadgeHitResponse,
} from '../shared/tampr-api';

const ACTIVE_BADGE_BACKGROUND = '#14594d';
const DEFAULT_TITLE = 'Tampr';

const BadgeHitMessageSchema = z
  .object({
    type: z.literal(TAMPR_BADGE_HIT_MESSAGE),
    snippetId: SnippetIdSchema,
  })
  .strict();

export type ActionBadgeApi = {
  setBadgeBackgroundColor(details: {
    color: string;
    tabId?: number;
  }): Promise<void> | void;
  setBadgeText(details: { tabId?: number; text: string }): Promise<void> | void;
  setTitle(details: { tabId?: number; title: string }): Promise<void> | void;
};

export type BadgeMessageSender = {
  tab?:
    | {
        id?: number | undefined;
      }
    | undefined;
};

export type BadgeTabsApi = {
  onRemoved?: {
    addListener(listener: (tabId: number) => void): void;
  };
  onUpdated?: {
    addListener(
      listener: (
        tabId: number,
        changeInfo: { status?: string; url?: string },
      ) => void,
    ): void;
  };
};

export class ActionBadgeController {
  private readonly activeSnippetIdsByTab = new Map<number, Set<string>>();

  constructor(private readonly action: ActionBadgeApi) {}

  installTabListeners(tabs: BadgeTabsApi | undefined): void {
    tabs?.onUpdated?.addListener((tabId, changeInfo) => {
      if (changeInfo.status === 'loading' || changeInfo.url) {
        void this.clearTab(tabId);
      }
    });

    tabs?.onRemoved?.addListener((tabId) => {
      this.activeSnippetIdsByTab.delete(tabId);
    });
  }

  isBadgeHitMessage(message: unknown): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === TAMPR_BADGE_HIT_MESSAGE
    );
  }

  async clearAll(): Promise<void> {
    this.activeSnippetIdsByTab.clear();
    await this.setBadgeCount(undefined, 0);
  }

  async clearTab(tabId: number): Promise<void> {
    this.activeSnippetIdsByTab.delete(tabId);
    await this.setBadgeCount(tabId, 0);
  }

  async handleBadgeHitMessage(
    message: unknown,
    sender: BadgeMessageSender,
  ): Promise<TamprBadgeHitResponse> {
    const validation = BadgeHitMessageSchema.safeParse(message);

    if (!validation.success) {
      return {
        ok: false,
        error: 'Invalid Tampr badge request.',
      };
    }

    const tabId = sender.tab?.id;

    if (typeof tabId !== 'number' || !Number.isInteger(tabId)) {
      return {
        ok: false,
        error: 'Tampr badge request is missing a tab.',
      };
    }

    const snippetIds =
      this.activeSnippetIdsByTab.get(tabId) ?? new Set<string>();
    snippetIds.add(validation.data.snippetId);
    this.activeSnippetIdsByTab.set(tabId, snippetIds);

    await this.setBadgeCount(tabId, snippetIds.size);

    return { ok: true };
  }

  private async setBadgeCount(
    tabId: number | undefined,
    count: number,
  ): Promise<void> {
    const tabDetails = tabId === undefined ? {} : { tabId };
    const text = count > 0 ? formatBadgeCount(count) : '';
    const title =
      count > 0
        ? `Tampr: ${count} active ${count === 1 ? 'snippet' : 'snippets'}`
        : DEFAULT_TITLE;

    await Promise.all([
      Promise.resolve(
        this.action.setBadgeBackgroundColor({
          ...tabDetails,
          color: ACTIVE_BADGE_BACKGROUND,
        }),
      ),
      Promise.resolve(this.action.setBadgeText({ ...tabDetails, text })),
      Promise.resolve(this.action.setTitle({ ...tabDetails, title })),
    ]);
  }
}

function formatBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}
