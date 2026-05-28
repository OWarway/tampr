import { describe, expect, it } from 'vitest';

import {
  BLUEPRINT_SNIPPET_FOLDER,
  buildBlueprintSnippetDraft,
} from '../../src/domain/blueprint-snippets';

describe('blueprint snippet drafts', () => {
  it('creates a hide snippet scoped to the current path', () => {
    expect(
      buildBlueprintSnippetDraft({
        action: 'hide',
        pageUrl: 'https://docs.example.com/articles/intro?token=private',
        pick: {
          label: 'Subscribe panel',
          selector: 'aside.subscribe',
          tagName: 'aside',
        },
      }),
    ).toEqual({
      name: 'Hide Subscribe panel',
      folder: BLUEPRINT_SNIPPET_FOLDER,
      enabled: true,
      matches: ['https://docs.example.com/articles/intro*'],
      excludeMatches: [],
      css: `aside.subscribe {
  display: none !important;
}`,
      js: '',
      runAt: 'document_idle',
      world: 'USER_SCRIPT',
    });
  });

  it('creates a highlight snippet with editable CSS', () => {
    expect(
      buildBlueprintSnippetDraft({
        action: 'highlight',
        pageUrl: 'https://example.com/',
        pick: {
          label: 'Primary button',
          selector: 'main > button.primary',
          tagName: 'button',
        },
      }).css,
    ).toBe(`main > button.primary {
  outline: 3px solid #d44d3a !important;
  outline-offset: 3px !important;
}`);
  });

  it('rejects unsupported page URLs', () => {
    expect(() =>
      buildBlueprintSnippetDraft({
        action: 'hide',
        pageUrl: 'chrome://extensions',
        pick: {
          label: 'Extension details',
          selector: 'main',
          tagName: 'main',
        },
      }),
    ).toThrow('Blueprints need an http or https page.');
  });
});
