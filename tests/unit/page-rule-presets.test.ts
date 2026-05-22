import { describe, expect, it } from 'vitest';

import { buildPageRulePresets } from '../../src/domain/page-rule-presets';
import {
  getWorkspaceSourcePageUrl,
  sanitizeWebPageUrl,
} from '../../src/shared/workspace-source-page';

describe('page rule presets', () => {
  it('builds page, path, and site patterns from web page context', () => {
    expect(
      buildPageRulePresets('https://docs.example.com/snippets/new'),
    ).toEqual([
      {
        id: 'page',
        label: 'Page',
        pattern: 'https://docs.example.com/snippets/new',
      },
      {
        id: 'path',
        label: 'Path',
        pattern: 'https://docs.example.com/snippets/new*',
      },
      {
        id: 'site',
        label: 'Site',
        pattern: '*://docs.example.com/*',
      },
    ]);
  });

  it('sanitizes popup page context before reading workspace presets', () => {
    expect(
      sanitizeWebPageUrl('https://example.com/path?token=private#draft'),
    ).toBe('https://example.com/path');
    expect(
      getWorkspaceSourcePageUrl(
        'chrome-extension://tampr/workspace.html?sourcePage=https%3A%2F%2Fexample.com%2Fpath%3Ftoken%3Dprivate',
      ),
    ).toBe('https://example.com/path');
    expect(sanitizeWebPageUrl('chrome://extensions')).toBeUndefined();
  });
});
