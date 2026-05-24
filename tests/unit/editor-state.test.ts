import { describe, expect, it } from 'vitest';

import {
  appendEditorRuleLine,
  duplicateEditor,
  hasUnsavedChanges,
  toEditorState,
  validateEditorRuleLines,
} from '../../src/workspace/editor-state';
import { buildSnippet, SnippetDraftSchema } from '../../src/domain/snippets';

describe('editor state', () => {
  it('duplicates a saved editor as a new named draft', () => {
    const duplicate = duplicateEditor(toEditorState(createSnippet()));

    expect(duplicate).toMatchObject({
      folder: 'Daily',
      name: 'Daily cleanup copy',
      matches: '*://example.com/*',
    });
    expect(duplicate).not.toHaveProperty('id');
  });

  it('detects changes against the stored snippet', () => {
    const snippet = createSnippet();
    const savedEditor = toEditorState(snippet);

    expect(hasUnsavedChanges(savedEditor, [snippet])).toBe(false);
    expect(
      hasUnsavedChanges(
        { ...savedEditor, folder: 'Focus', css: 'main { display: grid; }' },
        [snippet],
      ),
    ).toBe(true);
    expect(hasUnsavedChanges(duplicateEditor(savedEditor), [snippet])).toBe(
      true,
    );
  });

  it('validates and appends editor match-rule lines', () => {
    expect(validateEditorRuleLines('', true)).toEqual([
      {
        line: 1,
        message: 'Add a match rule before this snippet can run.',
      },
    ]);
    expect(
      validateEditorRuleLines('*://example.com/*\nexample.com/private', false),
    ).toEqual([
      {
        line: 2,
        message: 'Use a web match pattern such as *://example.com/*.',
      },
    ]);
    expect(appendEditorRuleLine('*://example.com/*', '*://example.com/*')).toBe(
      '*://example.com/*',
    );
    expect(
      appendEditorRuleLine('*://example.com/*', 'https://example.com/docs*'),
    ).toBe('*://example.com/*\nhttps://example.com/docs*');
  });
});

function createSnippet() {
  return buildSnippet({
    id: 'daily-cleanup',
    now: 1_748_000_000_000,
    draft: SnippetDraftSchema.parse({
      name: 'Daily cleanup',
      folder: 'Daily',
      matches: ['*://example.com/*'],
      css: 'main { outline: 1px solid red; }',
    }),
  });
}
