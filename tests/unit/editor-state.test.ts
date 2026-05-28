import { describe, expect, it } from 'vitest';

import {
  appendEditorRuleLine,
  duplicateEditor,
  hasUnsavedChanges,
  parseEditorDraft,
  toEditorState,
  validateEditorRuleLines,
} from '../../src/workspace/editor-state';
import { buildSnippet, SnippetDraftSchema } from '../../src/domain/snippets';
import { buildCssBlueprintRecipe } from '../../src/domain/blueprints/recipe';

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

  it('preserves blueprint metadata through editor drafts', () => {
    const blueprint = createBlueprint();
    const snippet = createSnippet({ blueprint });
    const editor = toEditorState(snippet);

    expect(editor.blueprint).toEqual(blueprint);
    expect(duplicateEditor(editor).blueprint).toEqual(blueprint);
    expect(parseEditorDraft(editor)).toMatchObject({
      ok: true,
      draft: {
        blueprint,
      },
    });
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

type CreateSnippetInput = {
  blueprint?: ReturnType<typeof createBlueprint>;
};

function createSnippet({ blueprint }: CreateSnippetInput = {}) {
  return buildSnippet({
    id: 'daily-cleanup',
    now: 1_748_000_000_000,
    draft: SnippetDraftSchema.parse({
      name: 'Daily cleanup',
      folder: 'Daily',
      matches: ['*://example.com/*'],
      css: 'main { outline: 1px solid red; }',
      blueprint,
    }),
  });
}

function createBlueprint() {
  return buildCssBlueprintRecipe({
    id: 'highlight-selection',
    label: 'Highlight main',
    selector: 'main',
    selectorMeta: {
      matchCount: 1,
      segmentCount: 1,
      strategy: 'attribute',
      usesNthOfType: false,
    },
    type: 'highlight',
  });
}
