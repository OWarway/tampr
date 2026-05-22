import type { FormEvent } from 'react';

import type { Snippet } from '../../domain/snippets';
import type { WorkspaceState } from '../../shared/workspace-messages';
import type { EditorState } from '../editor-state';
import { runtimeNotice } from '../runtime-copy';

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
    <section className="editor-shell" aria-label="Snippet editor">
      <div className="editor-shell__tabs">
        <span>Rules</span>
        <span>CSS</span>
        <span>JavaScript</span>
      </div>
      <form className="snippet-editor" onSubmit={submit}>
        <label>
          <span>Name</span>
          <input
            value={editor.name}
            onChange={(event) =>
              onUpdate({ ...editor, name: event.target.value })
            }
          />
        </label>

        <label>
          <span>Match rules</span>
          <textarea
            value={editor.matches}
            onChange={(event) =>
              onUpdate({ ...editor, matches: event.target.value })
            }
          />
        </label>

        <label>
          <span>Exclude rules</span>
          <textarea
            value={editor.excludeMatches}
            onChange={(event) =>
              onUpdate({ ...editor, excludeMatches: event.target.value })
            }
          />
        </label>

        <label>
          <span>CSS</span>
          <textarea
            className="snippet-editor__code"
            value={editor.css}
            onChange={(event) =>
              onUpdate({ ...editor, css: event.target.value })
            }
          />
        </label>

        <label>
          <span>JavaScript</span>
          <textarea
            className="snippet-editor__code"
            value={editor.js}
            onChange={(event) =>
              onUpdate({ ...editor, js: event.target.value })
            }
          />
        </label>

        <div className="snippet-editor__settings">
          <label>
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

          <label>
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

          <label className="snippet-editor__toggle">
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

        <footer>
          <p role="status">{runtimeNotice(workspace, notice)}</p>
          <div>
            <button type="button" onClick={onDelete}>
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
