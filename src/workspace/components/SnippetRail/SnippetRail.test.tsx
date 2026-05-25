// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSnippet, SnippetDraftSchema } from '../../../domain/snippets';
import {
  newSnippetEditor,
  toEditorState,
  type EditorState,
} from '../../editor-state';
import { SnippetRail } from './SnippetRail';

afterEach(cleanup);

describe('SnippetRail', () => {
  it('creates a new editor and selects saved snippets', () => {
    const snippet = createSnippet();
    const onCreate = vi.fn();
    const onSelect = vi.fn();

    renderRail({
      snippets: [snippet],
      onCreate,
      onSelect,
    });

    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.click(screen.getByRole('button', { name: /Example proof/ }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(toEditorState(snippet));
  });

  it('shows the empty state', () => {
    renderRail({ snippets: [] });

    expect(screen.getByText('No snippets yet.')).toBeTruthy();
  });

  it('searches snippet names and match rules', () => {
    renderRail({
      snippets: [
        createSnippet({ name: 'Example proof' }),
        createSnippet({
          folder: 'Docs',
          name: 'Route cleaner',
          match: '*://docs.example.com/*',
        }),
      ],
    });

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'docs.example' },
    });

    expect(screen.getByRole('button', { name: /Route cleaner/ })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Collapse Docs folder' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Example proof/ })).toBeNull();

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'missing' },
    });

    expect(screen.getByText('No snippets match.')).toBeTruthy();
  });

  it('groups snippets by folder and searches folder names', () => {
    renderRail({
      snippets: [
        createSnippet({ folder: 'Design', name: 'Theme cleanup' }),
        createSnippet({ name: 'Default proof' }),
      ],
    });

    expect(
      screen.getByRole('button', { name: 'Collapse General folder' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Collapse Design folder' }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'design' },
    });

    expect(screen.getByRole('button', { name: /Theme cleanup/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Default proof/ })).toBeNull();
  });

  it('collapses and expands folder sections', () => {
    renderRail({
      snippets: [
        createSnippet({ folder: 'Design', name: 'Theme cleanup' }),
        createSnippet({ name: 'Default proof' }),
      ],
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Collapse Design folder' }),
    );

    expect(screen.queryByRole('button', { name: /Theme cleanup/ })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Expand Design folder' }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Design folder' }),
    );

    expect(screen.getByRole('button', { name: /Theme cleanup/ })).toBeTruthy();
  });

  it('renames folder sections', () => {
    const onRenameFolder = vi.fn();

    renderRail({
      snippets: [createSnippet({ folder: 'Design', name: 'Theme cleanup' })],
      onRenameFolder,
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Rename Design folder' }),
    );
    fireEvent.change(screen.getByLabelText('Folder name for Design'), {
      target: { value: 'Research' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save folder' }));

    expect(onRenameFolder).toHaveBeenCalledWith('Design', 'Research');
  });

  it('moves snippets back to General when deleting a folder section', () => {
    const onDeleteFolder = vi.fn();

    renderRail({
      snippets: [
        createSnippet({ folder: 'Design', name: 'Theme cleanup' }),
        createSnippet({ name: 'Default proof' }),
      ],
      onDeleteFolder,
    });

    expect(
      screen.queryByRole('button', { name: 'Delete General folder' }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Design folder' }),
    );

    expect(screen.getByText('Move 1 snippet to General.')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Move snippets to General' }),
    );

    expect(onDeleteFolder).toHaveBeenCalledWith('Design');
  });
});

type RenderRailInput = {
  editor?: EditorState;
  onCreate?: () => void;
  onDeleteFolder?: (folder: string) => void;
  onRenameFolder?: (folder: string, nextFolder: string) => void;
  onSelect?: (editor: EditorState) => void;
  snippets: ReturnType<typeof createSnippet>[];
};

function renderRail({
  editor = newSnippetEditor,
  onCreate = () => undefined,
  onDeleteFolder = () => undefined,
  onRenameFolder = () => undefined,
  onSelect = () => undefined,
  snippets,
}: RenderRailInput) {
  return render(
    <SnippetRail
      editor={editor}
      snippets={snippets}
      onCreate={onCreate}
      onDeleteFolder={onDeleteFolder}
      onRenameFolder={onRenameFolder}
      onSelect={onSelect}
    />,
  );
}

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
