import { useEffect, useRef, useState } from 'react';

import {
  pickBlueprintSelector as pickBlueprintSelectorFromTab,
  testBlueprintAutomationNode as testBlueprintAutomationNodeFromTab,
  testBlueprintSelector as testBlueprintSelectorFromTab,
} from '../../chrome/blueprints';
import { requestHostAccess } from '../../chrome/host-access';
import {
  deleteSnippetFolder,
  getWorkspaceState,
  importSnippetExport,
  renameSnippetFolder,
  removeSnippet,
  saveSnippetDraft,
} from '../../chrome/workspace-state';
import { createSnippetExport } from '../../domain/snippet-export';
import type { BlueprintElementPick } from '../../domain/blueprint-snippets';
import {
  DEFAULT_SNIPPET_FOLDER,
  SnippetDraftSchema,
  type Snippet,
} from '../../domain/snippets';
import type { WorkspaceState } from '../../shared/workspace-messages';
import type {
  BlueprintAutomationNodeTestInput,
  BlueprintAutomationNodeTestResult,
  BlueprintSelectorTestResult,
} from '../../shared/blueprint-messages';
import {
  getWorkspaceSelectedSnippetId,
  getWorkspaceSourceTabId,
} from '../../shared/workspace-source-page';
import { downloadJson } from '../download-json';
import {
  duplicateEditor,
  findSavedSnippet,
  hasUnsavedChanges,
  newSnippetEditor,
  parseEditorDraft,
  toEditorState,
  type EditorState,
} from '../editor-state';

export type UseWorkspaceResult = {
  busy: boolean;
  dirty: boolean;
  editor: EditorState;
  notice: string;
  workspace: WorkspaceState | undefined;
  clearEditor(): void;
  deleteEditor(): Promise<void>;
  duplicateCurrentEditor(): void;
  deleteFolder(folder: string): Promise<void>;
  exportWorkspace(): Promise<void>;
  importWorkspaceFile(file: File): Promise<void>;
  renameFolder(folder: string, nextFolder: string): Promise<void>;
  pickBlueprintSelector(): Promise<BlueprintElementPick | undefined>;
  saveEditor(): Promise<void>;
  selectEditor(editor: EditorState): void;
  testBlueprintSelector(
    selector: string,
  ): Promise<BlueprintSelectorTestResult | undefined>;
  testBlueprintAutomationNode(
    node: BlueprintAutomationNodeTestInput,
  ): Promise<BlueprintAutomationNodeTestResult | undefined>;
  updateEditor(editor: EditorState): void;
  updateEditorFolder(folder: string): void;
};

type UpdateFolderLabelsInput = {
  folder: string;
  nextFolder: string;
  save: () => Promise<WorkspaceState>;
  successNotice: string;
};

export function useWorkspace(): UseWorkspaceResult {
  const [workspace, setWorkspace] = useState<WorkspaceState>();
  const [editor, setEditor] = useState<EditorState>(newSnippetEditor);
  const [notice, setNotice] = useState('Loading local snippets.');
  const [busy, setBusy] = useState(true);
  const folderSaveIdRef = useRef(0);

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

        const selectedSnippet = selectedSnippetFromUrl(state);

        if (selectedSnippet) {
          setEditor(toEditorState(selectedSnippet));
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

  async function pickBlueprintSelector(): Promise<
    BlueprintElementPick | undefined
  > {
    const sourceTabId = getWorkspaceSourceTabId(window.location.href);

    if (!sourceTabId) {
      setNotice('Open the workspace from a page before re-picking selectors.');
      return undefined;
    }

    setBusy(true);
    setNotice('Pick a replacement element on the source page.');

    try {
      const response = await pickBlueprintSelectorFromTab(sourceTabId);

      if (!response.ok) {
        setNotice(response.error);
        return undefined;
      }

      if (response.status === 'cancelled' || !response.pick) {
        setNotice('Selector picking cancelled.');
        return undefined;
      }

      setNotice('Selector picked. Save the snippet to sync it.');
      return response.pick;
    } catch (error: unknown) {
      setNotice(toErrorMessage(error));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function testBlueprintSelector(
    selector: string,
  ): Promise<BlueprintSelectorTestResult | undefined> {
    const sourceTabId = getWorkspaceSourceTabId(window.location.href);

    if (!sourceTabId) {
      setNotice('Open the workspace from a page before testing selectors.');
      return undefined;
    }

    setBusy(true);
    setNotice('Testing selector on the source page.');

    try {
      const response = await testBlueprintSelectorFromTab(
        sourceTabId,
        selector,
      );

      if (!response.ok) {
        setNotice(response.error);
        return undefined;
      }

      setNotice(
        `Selector test complete: ${selectorTestNotice(response.result)}.`,
      );
      return response.result;
    } catch (error: unknown) {
      setNotice(toErrorMessage(error));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function testBlueprintAutomationNode(
    node: BlueprintAutomationNodeTestInput,
  ): Promise<BlueprintAutomationNodeTestResult | undefined> {
    const sourceTabId = getWorkspaceSourceTabId(window.location.href);

    if (!sourceTabId) {
      setNotice('Open the workspace from a page before testing automation.');
      return undefined;
    }

    setBusy(true);
    setNotice('Testing automation node on the source page.');

    try {
      const response = await testBlueprintAutomationNodeFromTab(
        sourceTabId,
        node,
      );

      if (!response.ok) {
        setNotice(response.error);
        return undefined;
      }

      setNotice(
        `Automation test complete: ${automationTestNotice(response.result)}.`,
      );
      return response.result;
    } catch (error: unknown) {
      setNotice(toErrorMessage(error));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function deleteEditor(): Promise<void> {
    if (!editor.id) {
      resetEditor();
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
    if (workspace && hasUnsavedChanges(editor, workspace.snippets)) {
      setNotice('Save or clear unsaved changes before starting a snippet.');
      return;
    }

    resetEditor();
    setNotice('New snippet ready.');
  }

  function duplicateCurrentEditor(): void {
    setEditor(duplicateEditor(editor));
    setNotice('Snippet duplicated. Save the copy to sync it.');
  }

  async function exportWorkspace(): Promise<void> {
    if (!workspace) {
      setNotice('Workspace is still loading.');
      return;
    }

    const snippetExport = createSnippetExport({
      now: Date.now(),
      snippets: workspace.snippets,
    });

    setBusy(true);

    try {
      const result = await downloadJson({
        filename: exportFilename(snippetExport.exportedAt),
        value: snippetExport,
      });

      setNotice(
        result.mode === 'browser-api'
          ? `${workspace.snippets.length} snippets exported with browser downloads.`
          : `${workspace.snippets.length} snippets exported.`,
      );
    } catch (error: unknown) {
      setNotice(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function importWorkspaceFile(file: File): Promise<void> {
    setBusy(true);

    try {
      const payload = parseJson(await file.text());
      const nextWorkspace = await importSnippetExport(payload);

      setWorkspace(nextWorkspace);
      setEditor(
        nextWorkspace.snippets[0]
          ? toEditorState(nextWorkspace.snippets[0])
          : newSnippetEditor,
      );
      setNotice(
        `${nextWorkspace.snippets.length} snippets ready after import.`,
      );
    } catch (error: unknown) {
      setNotice(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function selectEditor(nextEditor: EditorState): void {
    if (shouldKeepUnsavedEditor(nextEditor)) {
      setNotice('Save or clear unsaved changes before switching snippets.');
      return;
    }

    setEditor(nextEditor);
  }

  function updateEditorFolder(folder: string): void {
    const result = SnippetDraftSchema.pick({ folder: true }).safeParse({
      folder,
    });

    if (!result.success) {
      setNotice(result.error.issues[0]?.message ?? 'Folder is invalid.');
      return;
    }

    const nextFolder = result.data.folder;
    const nextEditor = { ...editor, folder: nextFolder };

    setEditor(nextEditor);

    if (!editor.id || !workspace) {
      return;
    }

    const savedSnippet = workspace.snippets.find(
      (snippet) => snippet.id === editor.id,
    );

    if (!savedSnippet || savedSnippet.folder === nextFolder) {
      return;
    }

    void saveFolderChange(savedSnippet, nextFolder);
  }

  async function renameFolder(
    folder: string,
    nextFolder: string,
  ): Promise<void> {
    const result = SnippetDraftSchema.pick({ folder: true }).safeParse({
      folder: nextFolder,
    });

    if (!result.success) {
      setNotice(result.error.issues[0]?.message ?? 'Folder is invalid.');
      return;
    }

    const parsedNextFolder = result.data.folder;

    if (folder === parsedNextFolder) {
      return;
    }

    await updateFolderLabels({
      folder,
      nextFolder: parsedNextFolder,
      save: () => renameSnippetFolder(folder, parsedNextFolder),
      successNotice: `Folder renamed to ${parsedNextFolder}.`,
    });
  }

  async function deleteFolder(folder: string): Promise<void> {
    if (folder === DEFAULT_SNIPPET_FOLDER) {
      return;
    }

    await updateFolderLabels({
      folder,
      nextFolder: DEFAULT_SNIPPET_FOLDER,
      save: () => deleteSnippetFolder(folder),
      successNotice: `Folder moved to ${DEFAULT_SNIPPET_FOLDER}.`,
    });
  }

  async function updateFolderLabels({
    folder,
    nextFolder,
    save,
    successNotice,
  }: UpdateFolderLabelsInput): Promise<void> {
    if (!workspace) {
      setNotice('Workspace is still loading.');
      return;
    }

    setBusy(true);

    try {
      const nextWorkspace = await save();

      setWorkspace(nextWorkspace);
      setEditor((currentEditor) =>
        currentEditor.folder === folder
          ? { ...currentEditor, folder: nextFolder }
          : currentEditor,
      );
      setNotice(successNotice);
    } catch (error: unknown) {
      setNotice(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveFolderChange(
    savedSnippet: Snippet,
    folder: string,
  ): Promise<void> {
    const saveId = folderSaveIdRef.current + 1;
    folderSaveIdRef.current = saveId;

    try {
      const nextWorkspace = await saveSnippetDraft(
        SnippetDraftSchema.parse({
          id: savedSnippet.id,
          name: savedSnippet.name,
          folder,
          enabled: savedSnippet.enabled,
          matches: savedSnippet.matches,
          excludeMatches: savedSnippet.excludeMatches,
          css: savedSnippet.css,
          js: savedSnippet.js,
          runAt: savedSnippet.runAt,
          world: savedSnippet.world,
          blueprint: savedSnippet.blueprint,
        }),
      );

      if (folderSaveIdRef.current === saveId) {
        setWorkspace(nextWorkspace);
        setNotice('Folder saved.');
      }
    } catch (error: unknown) {
      if (folderSaveIdRef.current === saveId) {
        setNotice(toErrorMessage(error));
      }
    }
  }

  function shouldKeepUnsavedEditor(nextEditor: EditorState): boolean {
    if (!workspace || editor.id === nextEditor.id) {
      return false;
    }

    return hasUnsavedChanges(editor, workspace.snippets);
  }

  function resetEditor(): void {
    setEditor(newSnippetEditor);
  }

  return {
    busy,
    dirty: workspace ? hasUnsavedChanges(editor, workspace.snippets) : false,
    editor,
    notice,
    workspace,
    clearEditor,
    deleteEditor,
    deleteFolder,
    duplicateCurrentEditor,
    exportWorkspace,
    importWorkspaceFile,
    pickBlueprintSelector,
    renameFolder,
    saveEditor,
    selectEditor,
    testBlueprintAutomationNode,
    testBlueprintSelector,
    updateEditor: setEditor,
    updateEditorFolder,
  };
}

function selectedSnippetFromUrl(state: WorkspaceState): Snippet | undefined {
  const selectedSnippetId = getWorkspaceSelectedSnippetId(window.location.href);

  if (selectedSnippetId) {
    const selectedSnippet = state.snippets.find(
      (snippet) => snippet.id === selectedSnippetId,
    );

    if (selectedSnippet) {
      return selectedSnippet;
    }
  }

  return state.snippets[0];
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error('Import file is not valid JSON.');
  }
}

function exportFilename(exportedAt: number): string {
  const day = new Date(exportedAt).toISOString().slice(0, 10);
  return `tampr-snippets-${day}.json`;
}

function selectorTestNotice(result: BlueprintSelectorTestResult): string {
  return `${plural(result.matchCount, 'match')}, ${result.visibleCount} visible`;
}

function automationTestNotice(
  result: BlueprintAutomationNodeTestResult,
): string {
  return result.ready
    ? `${result.action} ready`
    : `${result.action} needs review`;
}

function plural(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 'es'}`;
}
