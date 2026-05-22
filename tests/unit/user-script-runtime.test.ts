import { describe, expect, it } from 'vitest';

import { buildSnippet, SnippetDraftSchema } from '../../src/domain/snippets';
import {
  buildSnippetRegistrations,
  buildStyleBridgeSource,
  syncUserScripts,
  type RuntimeRegistration,
  type UserScriptsApi,
} from '../../src/runtime/user-script-runtime';

describe('user script runtime', () => {
  it('keeps CSS and JavaScript registrations separate', () => {
    const snippet = createRuntimeSnippet();
    const registrations = buildSnippetRegistrations(
      snippet,
      snippet.matches,
      snippet.excludeMatches,
    );

    expect(registrations.map((registration) => registration.id)).toEqual([
      'tampr-style-snippet-1',
      'tampr-script-snippet-1',
    ]);
    expect(registrations[0]?.world).toBe('USER_SCRIPT');
    expect(registrations[1]?.world).toBe('MAIN');
  });

  it('unregisters previous Tampr scripts and filters by granted access', async () => {
    const userScripts = new MemoryUserScripts([{ id: 'tampr-stale' }]);

    const status = await syncUserScripts({
      userScripts,
      snippets: [createRuntimeSnippet()],
      hasMatchAccess: async (pattern) => pattern === '*://example.com/*',
    });

    expect(userScripts.unregisteredIds).toEqual(['tampr-stale']);
    expect(userScripts.registered).toHaveLength(2);
    expect(status).toMatchObject({
      state: 'ready',
      registrations: 2,
    });
  });

  it('skips snippets until host access exists', async () => {
    const status = await syncUserScripts({
      userScripts: new MemoryUserScripts(),
      snippets: [createRuntimeSnippet()],
      hasMatchAccess: async () => false,
    });

    expect(status.skipped).toEqual([
      { snippetId: 'snippet-1', reason: 'host-access' },
    ]);
  });

  it('escapes user CSS inside the generated style bridge', () => {
    const source = buildStyleBridgeSource(
      'snippet-1',
      `body::before { content: '</style>'; }`,
    );

    expect(source).toContain(`const css = "body::before`);
    expect(source).toContain(`id = "tampr-style-snippet-1"`);
  });
});

function createRuntimeSnippet() {
  return buildSnippet({
    id: 'snippet-1',
    now: 1_748_000_000_000,
    draft: SnippetDraftSchema.parse({
      name: 'Example',
      enabled: true,
      matches: ['*://example.com/*'],
      excludeMatches: ['*://example.com/private/*'],
      css: 'main { outline: 1px solid red; }',
      js: `document.documentElement.dataset.tampr = 'active';`,
      runAt: 'document_idle',
      world: 'MAIN',
    }),
  });
}

class MemoryUserScripts implements UserScriptsApi {
  public readonly registered: RuntimeRegistration[] = [];
  public readonly unregisteredIds: string[] = [];

  constructor(private scripts: Array<{ id: string }> = []) {}

  async getScripts(): Promise<Array<{ id: string }>> {
    return this.scripts;
  }

  async register(scripts: RuntimeRegistration[]): Promise<void> {
    this.registered.push(...scripts);
    this.scripts.push(...scripts.map(({ id }) => ({ id })));
  }

  async unregister(filter: { ids: string[] }): Promise<void> {
    this.unregisteredIds.push(...filter.ids);
    this.scripts = this.scripts.filter(
      (script) => !filter.ids.includes(script.id),
    );
  }
}
