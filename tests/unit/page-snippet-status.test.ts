import { describe, expect, it } from 'vitest';

import { derivePageSnippetStatus } from '../../src/domain/page-snippet-status';
import { buildSnippet, SnippetDraftSchema } from '../../src/domain/snippets';

describe('derivePageSnippetStatus', () => {
  it('keeps matching, enabled, and excluded snippets distinct', () => {
    expect(
      derivePageSnippetStatus(
        [
          createSnippet('enabled'),
          createSnippet('disabled', { enabled: false }),
          createSnippet('excluded', {
            excludeMatches: ['*://example.com/private/*'],
          }),
        ],
        'https://example.com/private/settings',
      ),
    ).toMatchObject({
      savedMatches: [
        { id: 'enabled', rule: '*://example.com/*' },
        { id: 'disabled', rule: '*://example.com/*' },
      ],
      enabledMatches: [{ id: 'enabled', rule: '*://example.com/*' }],
    });
  });
});

type SnippetOverrides = {
  enabled?: boolean;
  excludeMatches?: string[];
};

function createSnippet(id: string, overrides: SnippetOverrides = {}) {
  return buildSnippet({
    id,
    now: 1_748_000_000_000,
    draft: SnippetDraftSchema.parse({
      name: `${id} proof`,
      enabled: overrides.enabled,
      matches: ['*://example.com/*'],
      excludeMatches: overrides.excludeMatches,
      css: 'main { outline: 1px solid red; }',
    }),
  });
}
