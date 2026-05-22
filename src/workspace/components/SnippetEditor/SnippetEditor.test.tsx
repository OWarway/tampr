// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceState } from '../../../shared/workspace-messages';
import { newSnippetEditor } from '../../editor-state';
import { SnippetEditor } from './SnippetEditor';

afterEach(cleanup);

describe('SnippetEditor', () => {
  it('emits field updates and form actions', () => {
    const onDelete = vi.fn();
    const onSave = vi.fn();
    const onUpdate = vi.fn();

    render(
      <SnippetEditor
        busy={false}
        dirty={true}
        editor={newSnippetEditor}
        notice="Ready."
        workspace={undefined}
        onDelete={onDelete}
        onDuplicate={() => undefined}
        onSave={onSave}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Updated proof' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onUpdate).toHaveBeenCalledWith({
      ...newSnippetEditor,
      name: 'Updated proof',
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('surfaces runtime access state', () => {
    render(
      <SnippetEditor
        busy={false}
        dirty={false}
        editor={newSnippetEditor}
        notice="Saved."
        workspace={createHostAccessState()}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onSave={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe(
      'Host access is still needed before a matching snippet runs.',
    );
  });

  it('switches from code editing to rule controls', () => {
    render(
      <SnippetEditor
        busy={false}
        dirty={true}
        editor={newSnippetEditor}
        notice="Ready."
        workspace={undefined}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onSave={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'CSS code' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Rules' }));

    expect(screen.getByLabelText('Match rules')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'CSS code' })).toBeNull();
  });

  it('duplicates drafts and confirms saved snippet deletes', () => {
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();

    render(
      <SnippetEditor
        busy={false}
        dirty={false}
        editor={{ ...newSnippetEditor, id: 'saved-snippet' }}
        notice="Ready."
        workspace={undefined}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onSave={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    expect(screen.getByText('Saved')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete snippet' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('validates rule lines and appends current page presets', () => {
    const onUpdate = vi.fn();

    render(
      <SnippetEditor
        busy={false}
        dirty={true}
        editor={{ ...newSnippetEditor, matches: 'example.com/docs' }}
        notice="Ready."
        pageRulePresets={[
          {
            id: 'path',
            label: 'Path',
            pattern: 'https://example.com/docs*',
          },
        ]}
        workspace={undefined}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onSave={() => undefined}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
    fireEvent.click(screen.getByRole('button', { name: 'Path' }));

    expect(
      screen.getByText(
        'Line 1: Use a web match pattern such as *://example.com/*.',
      ),
    ).toBeTruthy();
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...newSnippetEditor,
      matches: 'example.com/docs\nhttps://example.com/docs*',
    });
  });
});

function createHostAccessState(): WorkspaceState {
  return {
    snippets: [],
    runtime: {
      state: 'ready',
      registrations: 0,
      skipped: [{ snippetId: 'snippet-editor-proof', reason: 'host-access' }],
      errors: [],
    },
  };
}
