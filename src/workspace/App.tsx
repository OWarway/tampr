import { useEffect, useState } from 'react';

import { requestHostAccess } from '../chrome/host-access';
import {
  getWorkspaceState,
  removeSnippet,
  saveSnippetDraft,
} from '../chrome/workspace-state';
import {
  SnippetDraftSchema,
  type Snippet,
  type SnippetDraft,
} from '../domain/snippets';
import type { WorkspaceState } from '../shared/workspace-messages';

import './workspace.css';

type EditorState = {
  id?: string;
  name: string;
  enabled: boolean;
  matches: string;
  excludeMatches: string;
  css: string;
  js: string;
  runAt: Snippet['runAt'];
  world: Snippet['world'];
};

const newSnippetEditor: EditorState = {
  name: 'Example highlight',
  enabled: true,
  matches: '*://example.com/*',
  excludeMatches: '',
  css: `body {
  outline: 4px solid #d44d3a;
  outline-offset: -4px;
}`,
  js: `document.documentElement.dataset.tampr = 'active';`,
  runAt: 'document_idle',
  world: 'USER_SCRIPT',
};

export function App() {
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

  async function saveCurrentSnippet(): Promise<void> {
    const draft = parseEditor(editor);

    if (!draft) {
      return;
    }

    setBusy(true);

    try {
      const hasAccess = await requestHostAccess(draft.matches);
      const nextWorkspace = await saveSnippetDraft(draft);
      const savedSnippet = findSavedSnippet(nextWorkspace, draft.id);

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

  async function deleteCurrentSnippet(): Promise<void> {
    if (!editor.id) {
      setEditor(newSnippetEditor);
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

  function parseEditor(value: EditorState): SnippetDraft | undefined {
    const result = SnippetDraftSchema.safeParse({
      ...value,
      matches: toPatternLines(value.matches),
      excludeMatches: toPatternLines(value.excludeMatches),
    });

    if (!result.success) {
      setNotice(result.error.issues[0]?.message ?? 'Snippet is invalid.');
      return undefined;
    }

    return result.data;
  }

  return (
    <main className="workspace">
      <header className="workspace__header">
        <div>
          <p>Tampr</p>
          <h1>Workspace</h1>
        </div>
        <span>{runtimeLabel(workspace)}</span>
      </header>

      <section className="workspace__body" aria-label="Snippet workspace">
        <aside className="snippet-rail" aria-label="Snippets">
          <div className="snippet-rail__top">
            <h2>Snippets</h2>
            <button
              type="button"
              onClick={() => {
                setEditor(newSnippetEditor);
                setNotice('New local snippet.');
              }}
            >
              New
            </button>
          </div>
          <ol>
            {workspace?.snippets.map((snippet) => (
              <li key={snippet.id}>
                <button
                  className={snippet.id === editor.id ? 'is-selected' : ''}
                  type="button"
                  onClick={() => setEditor(toEditorState(snippet))}
                >
                  <strong>{snippet.name}</strong>
                  <span>{snippet.matches[0] ?? 'No match rule'}</span>
                </button>
              </li>
            ))}
          </ol>
          {workspace?.snippets.length === 0 ? <p>No snippets yet.</p> : null}
        </aside>

        <section className="editor-shell" aria-label="Snippet editor">
          <div className="editor-shell__tabs">
            <span>Rules</span>
            <span>CSS</span>
            <span>JavaScript</span>
          </div>
          <form
            className="snippet-editor"
            onSubmit={(event) => {
              event.preventDefault();
              void saveCurrentSnippet();
            }}
          >
            <label>
              <span>Name</span>
              <input
                value={editor.name}
                onChange={(event) =>
                  setEditor({ ...editor, name: event.target.value })
                }
              />
            </label>

            <label>
              <span>Match rules</span>
              <textarea
                value={editor.matches}
                onChange={(event) =>
                  setEditor({ ...editor, matches: event.target.value })
                }
              />
            </label>

            <label>
              <span>Exclude rules</span>
              <textarea
                value={editor.excludeMatches}
                onChange={(event) =>
                  setEditor({ ...editor, excludeMatches: event.target.value })
                }
              />
            </label>

            <label>
              <span>CSS</span>
              <textarea
                className="snippet-editor__code"
                value={editor.css}
                onChange={(event) =>
                  setEditor({ ...editor, css: event.target.value })
                }
              />
            </label>

            <label>
              <span>JavaScript</span>
              <textarea
                className="snippet-editor__code"
                value={editor.js}
                onChange={(event) =>
                  setEditor({ ...editor, js: event.target.value })
                }
              />
            </label>

            <div className="snippet-editor__settings">
              <label>
                <span>Run</span>
                <select
                  value={editor.runAt}
                  onChange={(event) =>
                    setEditor({
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
                    setEditor({
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
                    setEditor({ ...editor, enabled: event.target.checked })
                  }
                />
                <span>Enabled</span>
              </label>
            </div>

            <footer>
              <p role="status">{runtimeNotice(workspace, notice)}</p>
              <div>
                <button
                  type="button"
                  onClick={() => void deleteCurrentSnippet()}
                >
                  Delete
                </button>
                <button type="submit" disabled={busy}>
                  Save
                </button>
              </div>
            </footer>
          </form>
        </section>
      </section>
    </main>
  );
}

function toEditorState(snippet: Snippet): EditorState {
  return {
    id: snippet.id,
    name: snippet.name,
    enabled: snippet.enabled,
    matches: snippet.matches.join('\n'),
    excludeMatches: snippet.excludeMatches.join('\n'),
    css: snippet.css,
    js: snippet.js,
    runAt: snippet.runAt,
    world: snippet.world,
  };
}

function toPatternLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function runtimeLabel(workspace: WorkspaceState | undefined): string {
  if (!workspace) {
    return 'Loading';
  }

  if (workspace.runtime.state === 'ready') {
    return `${workspace.runtime.registrations} registrations`;
  }

  return workspace.runtime.state === 'sync-error'
    ? 'Runtime error'
    : 'User Scripts unavailable';
}

function runtimeNotice(
  workspace: WorkspaceState | undefined,
  fallback: string,
): string {
  if (workspace?.runtime.errors[0]) {
    return workspace.runtime.errors[0].message;
  }

  if (workspace?.runtime.state === 'user-scripts-unavailable') {
    return 'User Scripts are unavailable for Tampr.';
  }

  if (workspace?.runtime.skipped[0]?.reason === 'host-access') {
    return 'Host access is still needed before a matching snippet runs.';
  }

  if (workspace?.runtime.skipped[0]?.reason === 'invalid-matches') {
    return 'A saved match rule cannot be registered.';
  }

  return fallback;
}

function findSavedSnippet(
  workspace: WorkspaceState,
  savedId: string | undefined,
): Snippet | undefined {
  if (savedId) {
    return workspace.snippets.find((snippet) => snippet.id === savedId);
  }

  return workspace.snippets.reduce<Snippet | undefined>((latest, snippet) => {
    return !latest || snippet.updatedAt > latest.updatedAt ? snippet : latest;
  }, undefined);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
