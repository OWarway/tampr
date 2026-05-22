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
        editor={newSnippetEditor}
        notice="Ready."
        workspace={undefined}
        onDelete={onDelete}
        onSave={onSave}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Updated proof' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

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
        editor={newSnippetEditor}
        notice="Saved."
        workspace={createHostAccessState()}
        onDelete={() => undefined}
        onSave={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe(
      'Host access is still needed before a matching snippet runs.',
    );
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
