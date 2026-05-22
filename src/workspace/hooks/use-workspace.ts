import { useEffect, useState } from 'react';

import { requestHostAccess } from '../../chrome/host-access';
import {
  getWorkspaceState,
  removeSnippet,
  saveSnippetDraft,
} from '../../chrome/workspace-state';
import type { WorkspaceState } from '../../shared/workspace-messages';
import {
  findSavedSnippet,
  newSnippetEditor,
  parseEditorDraft,
  toEditorState,
  type EditorState,
} from '../editor-state';

export type UseWorkspaceResult = {
  busy: boolean;
  editor: EditorState;
  notice: string;
  workspace: WorkspaceState | undefined;
  clearEditor(): void;
  deleteEditor(): Promise<void>;
  saveEditor(): Promise<void>;
  selectEditor(editor: EditorState): void;
  updateEditor(editor: EditorState): void;
};

export function useWorkspace(): UseWorkspaceResult {
  const [workspace, setWorkspace] = useState<WorkspaceState>();
  const [editor, setEditor] = useState<EditorState>(newSnippetEditor);
  const [notice, setNotice] = useState('Loading local snippets.');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;

    void getWorkspaceState()
      .then((state) => {
        if (!active) {
          return;
        }

        setWorkspace(state);
        setNotice('Runtime state loaded.');
        setBusy(false);

        if (state.snippets[0]) {
          setEditor(toEditorState(state.snippets[0]));
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setNotice(toErrorMessage(error));
          setBusy(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveEditor(): Promise<void> {
    const result = parseEditorDraft(editor);

    if (!result.ok) {
      setNotice(result.message);
      return;
    }

    setBusy(true);

    try {
      const hasAccess = await requestHostAccess(result.draft.matches);
      const nextWorkspace = await saveSnippetDraft(result.draft);
      const savedSnippet = findSavedSnippet(nextWorkspace, result.draft.id);

      setWorkspace(nextWorkspace);

      if (savedSnippet) {
        setEditor(toEditorState(savedSnippet));
      }

      setNotice(
        hasAccess
          ? 'Snippet saved and runtime synced.'
          : 'Snippet saved. Host access is still needed before it runs.',
      );
    } catch (error: unknown) {
      setNotice(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteEditor(): Promise<void> {
    if (!editor.id) {
      clearEditor();
      setNotice('New snippet cleared.');
      return;
    }

    setBusy(true);

    try {
      const nextWorkspace = await removeSnippet(editor.id);
      setWorkspace(nextWorkspace);
      setEditor(
        nextWorkspace.snippets[0]
          ? toEditorState(nextWorkspace.snippets[0])
          : newSnippetEditor,
      );
      setNotice('Snippet deleted and runtime synced.');
    } catch (error: unknown) {
      setNotice(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function clearEditor(): void {
    setEditor(newSnippetEditor);
  }

  return {
    busy,
    editor,
    notice,
    workspace,
    clearEditor,
    deleteEditor,
    saveEditor,
    selectEditor: setEditor,
    updateEditor: setEditor,
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
