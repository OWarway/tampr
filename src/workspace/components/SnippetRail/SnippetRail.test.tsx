// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSnippet, SnippetDraftSchema } from '../../../domain/snippets';
import { newSnippetEditor, toEditorState } from '../../editor-state';
import { SnippetRail } from './SnippetRail';

afterEach(cleanup);

describe('SnippetRail', () => {
  it('creates a new editor and selects saved snippets', () => {
    const snippet = createSnippet();
    const onCreate = vi.fn();
    const onSelect = vi.fn();

    render(
      <SnippetRail
        editor={newSnippetEditor}
        snippets={[snippet]}
        onCreate={onCreate}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.click(screen.getByRole('button', { name: /Example proof/ }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(toEditorState(snippet));
  });

  it('shows the empty state', () => {
    render(
      <SnippetRail
        editor={newSnippetEditor}
        snippets={[]}
        onCreate={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText('No snippets yet.')).toBeTruthy();
  });
});

function createSnippet() {
  return buildSnippet({
    id: 'snippet-rail-proof',
    now: 1_748_000_000_000,
    draft: SnippetDraftSchema.parse({
      name: 'Example proof',
      matches: ['*://example.com/*'],
      css: 'body { color: red; }',
    }),
  });
}
