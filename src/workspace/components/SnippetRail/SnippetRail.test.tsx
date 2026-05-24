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

  it('searches snippet names and match rules', () => {
    render(
      <SnippetRail
        editor={newSnippetEditor}
        snippets={[
          createSnippet({ name: 'Example proof' }),
          createSnippet({
            folder: 'Docs',
            name: 'Route cleaner',
            match: '*://docs.example.com/*',
          }),
        ]}
        onCreate={() => undefined}
        onSelect={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'docs.example' },
    });

    expect(screen.getByRole('button', { name: /Route cleaner/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Docs 1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Example proof/ })).toBeNull();

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'missing' },
    });

    expect(screen.getByText('No snippets match.')).toBeTruthy();
  });

  it('groups snippets by folder and searches folder names', () => {
    render(
      <SnippetRail
        editor={newSnippetEditor}
        snippets={[
          createSnippet({ folder: 'Design', name: 'Theme cleanup' }),
          createSnippet({ name: 'Default proof' }),
        ]}
        onCreate={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: 'General 1' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Design 1' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'design' },
    });

    expect(screen.getByRole('button', { name: /Theme cleanup/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Default proof/ })).toBeNull();
  });
});

type CreateSnippetInput = {
  folder?: string;
  match?: string;
  name?: string;
};

function createSnippet({
  folder = 'General',
  match = '*://example.com/*',
  name = 'Example proof',
}: CreateSnippetInput = {}) {
  return buildSnippet({
    id: name.toLocaleLowerCase().replaceAll(' ', '-'),
    now: 1_748_000_000_000,
    draft: SnippetDraftSchema.parse({
      name,
      folder,
      matches: [match],
      css: 'body { color: red; }',
    }),
  });
}
