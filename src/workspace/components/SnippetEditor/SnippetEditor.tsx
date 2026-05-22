import type { FormEvent } from 'react';

import type { Snippet } from '../../../domain/snippets';
import type { WorkspaceState } from '../../../shared/workspace-messages';
import type { EditorState } from '../../editor-state';
import { runtimeNotice } from '../../runtime-copy';

import styles from './SnippetEditor.module.scss';

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
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSave();
  }

  return (
    <section className={styles.shell} aria-label="Snippet editor">
      <div className={styles.tabs}>
        <span className={styles.tab}>Rules</span>
        <span className={styles.tab}>CSS</span>
        <span className={styles.tab}>JavaScript</span>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <label className={`${styles.field} ${styles.name}`}>
          <span>Name</span>
          <input
            value={editor.name}
            onChange={(event) =>
              onUpdate({ ...editor, name: event.target.value })
            }
          />
        </label>

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

        <label className={`${styles.field} ${styles.codeField}`}>
          <span>CSS</span>
          <textarea
            className={styles.code}
            value={editor.css}
            onChange={(event) =>
              onUpdate({ ...editor, css: event.target.value })
            }
          />
        </label>

        <label className={`${styles.field} ${styles.codeField}`}>
          <span>JavaScript</span>
          <textarea
            className={styles.code}
            value={editor.js}
            onChange={(event) =>
              onUpdate({ ...editor, js: event.target.value })
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
