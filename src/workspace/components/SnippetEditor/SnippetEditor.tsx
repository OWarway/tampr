import { useState, type FormEvent } from 'react';

import type { Snippet } from '../../../domain/snippets';
import type { WorkspaceState } from '../../../shared/workspace-messages';
import type { EditorState } from '../../editor-state';
import { runtimeNotice } from '../../runtime-copy';
import { CodeEditor } from '../CodeEditor/CodeEditor';

import styles from './SnippetEditor.module.scss';

const EDITOR_MODES = ['rules', 'css', 'javascript'] as const;

type EditorMode = (typeof EDITOR_MODES)[number];

type SnippetEditorProps = {
  busy: boolean;
  editor: EditorState;
  notice: string;
  workspace: WorkspaceState | undefined;
  onDelete(): void;
  onSave(): void;
  onUpdate(editor: EditorState): void;
};

export function SnippetEditor({
  busy,
  editor,
  notice,
  workspace,
  onDelete,
  onSave,
  onUpdate,
}: SnippetEditorProps) {
  const [mode, setMode] = useState<EditorMode>('css');

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSave();
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
            <label className={styles.field}>
              <span>Match rules</span>
              <textarea
                value={editor.matches}
                onChange={(event) =>
                  onUpdate({ ...editor, matches: event.target.value })
                }
              />
            </label>

            <label className={styles.field}>
              <span>Exclude rules</span>
              <textarea
                value={editor.excludeMatches}
                onChange={(event) =>
                  onUpdate({ ...editor, excludeMatches: event.target.value })
                }
              />
            </label>

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
          <p role="status">{runtimeNotice(workspace, notice)}</p>
          <div className={styles.actions}>
            <button className={styles.delete} type="button" onClick={onDelete}>
              Delete
            </button>
            <button type="submit" disabled={busy}>
              Save
            </button>
          </div>
        </footer>
      </form>
    </section>
  );
}

function modeLabel(mode: EditorMode): string {
  if (mode === 'javascript') {
    return 'JavaScript';
  }

  return mode === 'css' ? 'CSS' : 'Rules';
}
