import { describe, expect, it } from 'vitest';

import { buildPageRulePresets } from '../../src/domain/page-rule-presets';
import {
  buildWorkspaceUrl,
  getWorkspaceSelectedSnippetId,
  getWorkspaceSourcePageUrl,
  getWorkspaceSourceTabId,
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

  it('builds workspace URLs with selected snippet context', () => {
    const workspaceUrl = buildWorkspaceUrl({
      baseUrl: 'chrome-extension://tampr/workspace.html',
      selectedSnippetId: 'blueprint-snippet_1',
      sourceTabId: 42,
      sourcePageUrl: 'https://example.com/path?token=private#draft',
    });

    expect(workspaceUrl).toBe(
      'chrome-extension://tampr/workspace.html?sourcePage=https%3A%2F%2Fexample.com%2Fpath&snippet=blueprint-snippet_1&sourceTab=42',
    );
    expect(getWorkspaceSourcePageUrl(workspaceUrl)).toBe(
      'https://example.com/path',
    );
    expect(getWorkspaceSelectedSnippetId(workspaceUrl)).toBe(
      'blueprint-snippet_1',
    );
    expect(getWorkspaceSourceTabId(workspaceUrl)).toBe(42);
    expect(
      getWorkspaceSourceTabId(
        'chrome-extension://tampr/workspace.html?sourceTab=-1',
      ),
    ).toBeUndefined();
    expect(
      getWorkspaceSelectedSnippetId(
        'chrome-extension://tampr/workspace.html?snippet=../private',
      ),
    ).toBeUndefined();
  });
});
