import type { Snippet } from '../../domain/snippets';
import { toEditorState, type EditorState } from '../editor-state';

type SnippetRailProps = {
  editor: EditorState;
  snippets: readonly Snippet[];
  onCreate(): void;
  onSelect(editor: EditorState): void;
};

export function SnippetRail({
  editor,
  snippets,
  onCreate,
  onSelect,
}: SnippetRailProps) {
  return (
    <aside className="snippet-rail" aria-label="Snippets">
      <div className="snippet-rail__top">
        <h2>Snippets</h2>
        <button type="button" onClick={onCreate}>
          New
        </button>
      </div>
      <ol>
        {snippets.map((snippet) => (
          <li key={snippet.id}>
            <button
              className={snippet.id === editor.id ? 'is-selected' : ''}
              type="button"
              onClick={() => onSelect(toEditorState(snippet))}
            >
              <strong>{snippet.name}</strong>
              <span>{snippet.matches[0] ?? 'No match rule'}</span>
            </button>
          </li>
        ))}
      </ol>
      {snippets.length === 0 ? <p>No snippets yet.</p> : null}
    </aside>
  );
}
