import { useState, type FormEvent } from 'react';

import type { PageRulePreset } from '../../../domain/page-rule-presets';
import { DEFAULT_SNIPPET_FOLDER, type Snippet } from '../../../domain/snippets';
import type { WorkspaceState } from '../../../shared/workspace-messages';
import {
  appendEditorRuleLine,
  validateEditorRuleLines,
  type EditorRuleIssue,
  type EditorState,
} from '../../editor-state';
import { runtimeNotice } from '../../runtime-copy';
import { CodeEditor } from '../CodeEditor/CodeEditor';

import styles from './SnippetEditor.module.scss';

const EDITOR_MODES = ['rules', 'css', 'javascript'] as const;
const CUSTOM_FOLDER_VALUE = '__tampr_custom_folder__';

type EditorMode = (typeof EDITOR_MODES)[number];

type SnippetEditorProps = {
  busy: boolean;
  dirty: boolean;
  editor: EditorState;
  notice: string;
  pageRulePresets?: readonly PageRulePreset[] | undefined;
  workspace: WorkspaceState | undefined;
  onDelete(): void;
  onDuplicate(): void;
  onSave(): void;
  onUpdate(editor: EditorState): void;
};

export function SnippetEditor({
  busy,
  dirty,
  editor,
  notice,
  pageRulePresets = [],
  workspace,
  onDelete,
  onDuplicate,
  onSave,
  onUpdate,
}: SnippetEditorProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string>();
  const [mode, setMode] = useState<EditorMode>('css');
  const deletePending = editor.id !== undefined && deleteTargetId === editor.id;
  const excludeRuleIssues = validateEditorRuleLines(
    editor.excludeMatches,
    false,
  );
  const matchRuleIssues = validateEditorRuleLines(editor.matches, true);
  const folderOptions =
    workspace && workspace.snippets.length > 0
      ? uniqueFolders(workspace.snippets)
      : [editor.folder.trim() || DEFAULT_SNIPPET_FOLDER];
  const folderSelectValue = folderOptions.includes(editor.folder.trim())
    ? editor.folder.trim()
    : CUSTOM_FOLDER_VALUE;
  const editingCustomFolder = folderSelectValue === CUSTOM_FOLDER_VALUE;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSave();
  }

  function requestDelete(): void {
    if (!editor.id) {
      onDelete();
      return;
    }

    setDeleteTargetId(editor.id);
  }

  function confirmDelete(): void {
    setDeleteTargetId(undefined);
    onDelete();
  }

  function addPageRulePreset(preset: PageRulePreset): void {
    onUpdate({
      ...editor,
      matches: appendEditorRuleLine(editor.matches, preset.pattern),
    });
  }

  return (
    <section className={styles.shell} aria-label="Snippet editor">
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.identity}>
          <label className={`${styles.field} ${styles.name}`}>
            <span>Name</span>
            <input
              value={editor.name}
              onChange={(event) =>
                onUpdate({ ...editor, name: event.target.value })
              }
            />
          </label>

          <div className={`${styles.field} ${styles.folder}`}>
            <span>Folder</span>
            <div className={styles.folderControls}>
              <select
                aria-label="Folder"
                value={folderSelectValue}
                onChange={(event) => {
                  onUpdate({
                    ...editor,
                    folder:
                      event.target.value === CUSTOM_FOLDER_VALUE
                        ? ''
                        : event.target.value,
                  });
                }}
              >
                {folderOptions.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
                <option value={CUSTOM_FOLDER_VALUE}>New folder...</option>
              </select>
              {editingCustomFolder ? (
                <input
                  aria-label="Folder name"
                  value={editor.folder}
                  onChange={(event) =>
                    onUpdate({ ...editor, folder: event.target.value })
                  }
                />
              ) : null}
            </div>
          </div>

          <label className={styles.toggle}>
            <input
              checked={editor.enabled}
              type="checkbox"
              onChange={(event) =>
                onUpdate({ ...editor, enabled: event.target.checked })
              }
            />
            <span>Enabled</span>
          </label>

          <span
            className={`${styles.saveState} ${dirty ? styles.unsaved : ''}`}
          >
            {dirty ? 'Unsaved' : 'Saved'}
          </span>
        </div>

        <div className={styles.tabs} aria-label="Editor mode">
          {EDITOR_MODES.map((editorMode) => (
            <button
              aria-pressed={mode === editorMode}
              className={`${styles.tab} ${
                mode === editorMode ? styles.selected : ''
              }`}
              key={editorMode}
              type="button"
              onClick={() => setMode(editorMode)}
            >
              {modeLabel(editorMode)}
            </button>
          ))}
        </div>

        {mode === 'rules' ? (
          <div className={styles.rules}>
            <div className={styles.ruleField}>
              <label className={styles.field}>
                <span>Match rules</span>
                <textarea
                  value={editor.matches}
                  onChange={(event) =>
                    onUpdate({ ...editor, matches: event.target.value })
                  }
                />
              </label>
              <RuleIssues issues={matchRuleIssues} />
            </div>

            <div className={styles.ruleField}>
              <label className={styles.field}>
                <span>Exclude rules</span>
                <textarea
                  value={editor.excludeMatches}
                  onChange={(event) =>
                    onUpdate({ ...editor, excludeMatches: event.target.value })
                  }
                />
              </label>
              <RuleIssues issues={excludeRuleIssues} />
            </div>

            {pageRulePresets.length > 0 ? (
              <div className={styles.presets} aria-label="Page rule presets">
                {pageRulePresets.map((preset) => (
                  <button
                    key={preset.id}
                    title={preset.pattern}
                    type="button"
                    onClick={() => addPageRulePreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className={styles.ruleRuntime} aria-label="Rule runtime state">
              <strong>Runtime</strong>
              <span>{runtimeNotice(workspace, notice, editor.id)}</span>
            </div>

            <div className={styles.settings}>
              <label className={styles.setting}>
                <span>Run</span>
                <select
                  value={editor.runAt}
                  onChange={(event) =>
                    onUpdate({
                      ...editor,
                      runAt: event.target.value as Snippet['runAt'],
                    })
                  }
                >
                  <option value="document_idle">Document idle</option>
                  <option value="document_start">Document start</option>
                </select>
              </label>

              <label className={styles.setting}>
                <span>World</span>
                <select
                  value={editor.world}
                  onChange={(event) =>
                    onUpdate({
                      ...editor,
                      world: event.target.value as Snippet['world'],
                    })
                  }
                >
                  <option value="USER_SCRIPT">User script</option>
                  <option value="MAIN">Main</option>
                </select>
              </label>
            </div>
          </div>
        ) : (
          <CodeEditor
            label={`${modeLabel(mode)} code`}
            language={mode}
            value={editor[mode === 'css' ? 'css' : 'js']}
            onChange={(value) =>
              onUpdate({
                ...editor,
                [mode === 'css' ? 'css' : 'js']: value,
              })
            }
          />
        )}

        <footer className={styles.footer}>
          <p role="status">{runtimeNotice(workspace, notice, editor.id)}</p>
          <div className={styles.actions}>
            <button type="button" onClick={onDuplicate}>
              Duplicate
            </button>
            {deletePending ? (
              <>
                <button
                  className={styles.delete}
                  type="button"
                  onClick={() => setDeleteTargetId(undefined)}
                >
                  Cancel
                </button>
                <button
                  className={styles.confirmDelete}
                  type="button"
                  onClick={confirmDelete}
                >
                  Delete snippet
                </button>
              </>
            ) : (
              <button
                className={styles.delete}
                type="button"
                onClick={requestDelete}
              >
                {editor.id ? 'Delete' : 'Clear'}
              </button>
            )}
            <button type="submit" disabled={busy}>
              Save
            </button>
          </div>
        </footer>
      </form>
    </section>
  );
}

function uniqueFolders(snippets: readonly Snippet[]): string[] {
  const folders = new Set<string>();

  for (const snippet of snippets) {
    folders.add(snippet.folder);
  }

  return [...folders].sort((left, right) => left.localeCompare(right));
}

function modeLabel(mode: EditorMode): string {
  if (mode === 'javascript') {
    return 'JavaScript';
  }

  return mode === 'css' ? 'CSS' : 'Rules';
}

function RuleIssues({ issues }: { issues: readonly EditorRuleIssue[] }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <ul className={styles.ruleIssues} aria-live="polite">
      {issues.map((issue) => (
        <li key={`${issue.line}-${issue.message}`}>
          Line {issue.line}: {issue.message}
        </li>
      ))}
    </ul>
  );
}
