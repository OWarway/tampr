import { describe, expect, it } from 'vitest';

import {
  duplicateEditor,
  hasUnsavedChanges,
  toEditorState,
} from '../../src/workspace/editor-state';
import { buildSnippet, SnippetDraftSchema } from '../../src/domain/snippets';

describe('editor state', () => {
  it('duplicates a saved editor as a new named draft', () => {
    const duplicate = duplicateEditor(toEditorState(createSnippet()));

    expect(duplicate).toMatchObject({
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
      hasUnsavedChanges({ ...savedEditor, css: 'main { display: grid; }' }, [
        snippet,
      ]),
    ).toBe(true);
    expect(hasUnsavedChanges(duplicateEditor(savedEditor), [snippet])).toBe(
      true,
    );
  });
});

function createSnippet() {
  return buildSnippet({
    id: 'daily-cleanup',
    now: 1_748_000_000_000,
    draft: SnippetDraftSchema.parse({
      name: 'Daily cleanup',
      matches: ['*://example.com/*'],
      css: 'main { outline: 1px solid red; }',
    }),
  });
}
