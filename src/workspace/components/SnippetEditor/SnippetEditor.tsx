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
import { BlueprintPreview } from '../BlueprintPreview/BlueprintPreview';
import { CodeEditor } from '../CodeEditor/CodeEditor';

import styles from './SnippetEditor.module.scss';

const EDITOR_MODES = ['rules', 'css', 'javascript'] as const;
const CUSTOM_FOLDER_VALUE = '__tampr_custom_folder__';
const FIELD_HELP = {
  enabled:
    'Enabled snippets can run after their match rules and Chrome permissions allow them.',
  excludeRules:
    'Exclude rules stop this snippet on specific pages even when a match rule applies.',
  folder:
    'Folders are lightweight labels for keeping local snippets organized.',
  matchRules:
    'Match rules decide which pages can run this snippet. Use Chrome match patterns such as *://example.com/*.',
  name: 'A short local name for finding and recognizing this snippet.',
  run: 'Choose when JavaScript runs. Document idle is safest; document start runs earlier while the page is still loading.',
  world:
    'User script runs in Chrome isolated script space and gets Tampr APIs. Main runs beside page scripts and should be used only when a page integration needs it.',
} as const;

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
  onFolderChange(folder: string): void;
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
  onFolderChange,
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
          <div className={`${styles.field} ${styles.name}`}>
            <FieldLabel
              help={FIELD_HELP.name}
              helpId="snippet-name-help"
              htmlFor="snippet-name"
              label="Name"
            />
            <input
              aria-describedby="snippet-name-help"
              id="snippet-name"
              value={editor.name}
              onChange={(event) =>
                onUpdate({ ...editor, name: event.target.value })
              }
            />
          </div>

          <div className={`${styles.field} ${styles.folder}`}>
            <FieldLabel
              help={FIELD_HELP.folder}
              helpId="snippet-folder-help"
              htmlFor="snippet-folder"
              label="Folder"
            />
            <div className={styles.folderControls}>
              <select
                aria-describedby="snippet-folder-help"
                id="snippet-folder"
                value={folderSelectValue}
                onChange={(event) => {
                  const nextFolder =
                    event.target.value === CUSTOM_FOLDER_VALUE
                      ? ''
                      : event.target.value;

                  if (event.target.value === CUSTOM_FOLDER_VALUE) {
                    onUpdate({ ...editor, folder: nextFolder });
                    return;
                  }

                  onFolderChange(nextFolder);
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
                  onBlur={(event) => onFolderChange(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onFolderChange(event.currentTarget.value);
                    }
                  }}
                />
              ) : null}
            </div>
          </div>

          <div className={styles.toggle}>
            <label htmlFor="snippet-enabled">
              <input
                aria-describedby="snippet-enabled-help"
                checked={editor.enabled}
                id="snippet-enabled"
                type="checkbox"
                onChange={(event) =>
                  onUpdate({ ...editor, enabled: event.target.checked })
                }
              />
              <span>Enabled</span>
            </label>
            <FieldHelp
              help={FIELD_HELP.enabled}
              helpId="snippet-enabled-help"
              label="Enabled"
            />
          </div>

          <span
            className={`${styles.saveState} ${dirty ? styles.unsaved : ''}`}
          >
            {dirty ? 'Unsaved' : 'Saved'}
          </span>
        </div>

        <BlueprintPreview
          blueprint={editor.blueprint}
          css={editor.css}
          onChange={(blueprint, css) => onUpdate({ ...editor, blueprint, css })}
        />

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
              <div className={styles.field}>
                <FieldLabel
                  help={FIELD_HELP.matchRules}
                  helpId="snippet-match-rules-help"
                  htmlFor="snippet-match-rules"
                  label="Match rules"
                />
                <textarea
                  aria-describedby="snippet-match-rules-help"
                  id="snippet-match-rules"
                  value={editor.matches}
                  onChange={(event) =>
                    onUpdate({ ...editor, matches: event.target.value })
                  }
                />
              </div>
              <RuleIssues issues={matchRuleIssues} />
            </div>

            <div className={styles.ruleField}>
              <div className={styles.field}>
                <FieldLabel
                  help={FIELD_HELP.excludeRules}
                  helpId="snippet-exclude-rules-help"
                  htmlFor="snippet-exclude-rules"
                  label="Exclude rules"
                />
                <textarea
                  aria-describedby="snippet-exclude-rules-help"
                  id="snippet-exclude-rules"
                  value={editor.excludeMatches}
                  onChange={(event) =>
                    onUpdate({ ...editor, excludeMatches: event.target.value })
                  }
                />
              </div>
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
              <div className={styles.setting}>
                <FieldLabel
                  help={FIELD_HELP.run}
                  helpId="snippet-run-help"
                  htmlFor="snippet-run"
                  label="Run"
                />
                <select
                  aria-describedby="snippet-run-help"
                  id="snippet-run"
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
              </div>

              <div className={styles.setting}>
                <FieldLabel
                  help={FIELD_HELP.world}
                  helpId="snippet-world-help"
                  htmlFor="snippet-world"
                  label="World"
                />
                <select
                  aria-describedby="snippet-world-help"
                  id="snippet-world"
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
              </div>
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

type FieldLabelProps = {
  help: string;
  helpId: string;
  htmlFor: string;
  label: string;
};

function FieldLabel({ help, helpId, htmlFor, label }: FieldLabelProps) {
  return (
    <div className={styles.labelRow}>
      <label htmlFor={htmlFor}>{label}</label>
      <FieldHelp help={help} helpId={helpId} label={label} />
    </div>
  );
}

type FieldHelpProps = {
  help: string;
  helpId: string;
  label: string;
};

function FieldHelp({ help, helpId, label }: FieldHelpProps) {
  return (
    <span className={styles.help}>
      <button
        aria-describedby={helpId}
        aria-label={`${label} help`}
        className={styles.helpButton}
        type="button"
      >
        ?
      </button>
      <span className={styles.tooltip} id={helpId} role="tooltip">
        {help}
      </span>
    </span>
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
