// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { compileBlueprintCss } from '../../../domain/blueprints/compiler';
import { buildCssBlueprintRecipe } from '../../../domain/blueprints/recipe';
import { buildSnippet, SnippetDraftSchema } from '../../../domain/snippets';
import type { WorkspaceState } from '../../../shared/workspace-messages';
import { newSnippetEditor } from '../../editor-state';
import { SnippetEditor } from './SnippetEditor';

afterEach(cleanup);

describe('SnippetEditor', () => {
  it('emits field updates and form actions', () => {
    const onDelete = vi.fn();
    const onFolderChange = vi.fn();
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
        onFolderChange={onFolderChange}
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
    expect(onFolderChange).not.toHaveBeenCalled();
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
        onFolderChange={() => undefined}
        onSave={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe(
      'This page matches a snippet, but Chrome host access has not been granted for its rule yet.',
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
        onFolderChange={() => undefined}
        onSave={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'CSS code' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Rules' }));

    expect(screen.getByLabelText('Match rules')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'CSS code' })).toBeNull();
  });

  it('explains runtime fields with help tooltips', () => {
    render(
      <SnippetEditor
        busy={false}
        dirty={true}
        editor={newSnippetEditor}
        notice="Ready."
        workspace={undefined}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onFolderChange={() => undefined}
        onSave={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rules' }));

    expect(screen.getByRole('button', { name: 'Enabled help' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Run help' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'World help' })).toBeTruthy();
    expect(
      screen.getByText(/Document idle is safest; document start runs earlier/),
    ).toBeTruthy();
    expect(
      screen.getByText(/User script runs in Chrome isolated script space/),
    ).toBeTruthy();
  });

  it('renders saved blueprint metadata in the editor', () => {
    const blueprint = buildCssBlueprintRecipe({
      id: 'hide-signup-modal',
      label: 'Hide signup modal',
      selector: '[data-modal="signup"]',
      selectorMeta: blueprintSelectorMeta(),
      type: 'hide',
    });

    render(
      <SnippetEditor
        busy={false}
        dirty={false}
        editor={{
          ...newSnippetEditor,
          blueprint,
          css: compileBlueprintCss(blueprint),
        }}
        notice="Ready."
        workspace={undefined}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onFolderChange={() => undefined}
        onSave={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Blueprint preview' }),
    ).toBeTruthy();
    expect(screen.getAllByText('[data-modal="signup"]')).toHaveLength(2);
    expect(screen.getAllByText('Strong')).toHaveLength(2);
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
        onFolderChange={() => undefined}
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

  it('shows saved folders in an explicit folder menu', () => {
    const onFolderChange = vi.fn();
    const onUpdate = vi.fn();

    render(
      <SnippetEditor
        busy={false}
        dirty={false}
        editor={newSnippetEditor}
        notice="Ready."
        workspace={{
          runtime: readyRuntime(),
          snippets: [
            createSnippet('snippet-1', 'General'),
            createSnippet('snippet-2', 'Design'),
          ],
        }}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onFolderChange={onFolderChange}
        onSave={() => undefined}
        onUpdate={onUpdate}
      />,
    );

    const savedFolders = screen.getByLabelText('Folder') as HTMLSelectElement;

    expect([...savedFolders.options].map((option) => option.text)).toEqual([
      'Design',
      'General',
      'New folder...',
    ]);

    fireEvent.change(savedFolders, { target: { value: 'Design' } });

    expect(onFolderChange).toHaveBeenCalledWith('Design');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('shows a folder name field for unsaved custom folders', () => {
    const onFolderChange = vi.fn();
    const onUpdate = vi.fn();

    render(
      <SnippetEditor
        busy={false}
        dirty={true}
        editor={{ ...newSnippetEditor, folder: 'Reading' }}
        notice="Ready."
        workspace={{
          runtime: readyRuntime(),
          snippets: [createSnippet('snippet-1', 'General')],
        }}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onFolderChange={onFolderChange}
        onSave={() => undefined}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.change(screen.getByLabelText('Folder name'), {
      target: { value: 'Workflows' },
    });

    expect(onUpdate).toHaveBeenCalledWith({
      ...newSnippetEditor,
      folder: 'Workflows',
    });

    fireEvent.blur(screen.getByLabelText('Folder name'), {
      target: { value: 'Workflows' },
    });

    expect(onFolderChange).toHaveBeenCalledWith('Workflows');
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
        onFolderChange={() => undefined}
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
    runtime: readyRuntime([
      { snippetId: 'snippet-editor-proof', reason: 'host-access' },
    ]),
  };
}

function createSnippet(id: string, folder: string) {
  return buildSnippet({
    id,
    now: 1_748_000_000_000,
    draft: SnippetDraftSchema.parse({
      name: id,
      folder,
      matches: ['*://example.com/*'],
      css: '',
    }),
  });
}

function readyRuntime(
  skipped: WorkspaceState['runtime']['skipped'] = [],
): WorkspaceState['runtime'] {
  return {
    state: 'ready',
    registrations: 0,
    skipped,
    errors: [],
  };
}

function blueprintSelectorMeta() {
  return {
    matchCount: 1,
    segmentCount: 1,
    strategy: 'attribute' as const,
    usesNthOfType: false,
  };
}
