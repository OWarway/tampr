import { useState } from 'react';

import type { Snippet } from '../../../domain/snippets';
import { toEditorState, type EditorState } from '../../editor-state';

import styles from './SnippetRail.module.scss';

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
  const [query, setQuery] = useState('');
  const visibleSnippets = filterSnippets(snippets, query);

  return (
    <aside className={styles.rail} aria-label="Snippets">
      <div className={styles.top}>
        <h2>Snippets</h2>
        <button type="button" onClick={onCreate}>
          New
        </button>
      </div>
      <label className={styles.search}>
        <span>Search</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ol className={styles.list}>
        {visibleSnippets.map((snippet) => (
          <li key={snippet.id}>
            <button
              className={`${styles.item} ${
                snippet.id === editor.id ? styles.selected : ''
              }`}
              type="button"
              onClick={() => onSelect(toEditorState(snippet))}
            >
              <strong>{snippet.name}</strong>
              <span className={styles.meta}>
                {snippet.matches[0] ?? 'No match rule'}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {snippets.length === 0 ? (
        <p className={styles.empty}>No snippets yet.</p>
      ) : visibleSnippets.length === 0 ? (
        <p className={styles.empty}>No snippets match.</p>
      ) : null}
    </aside>
  );
}

function filterSnippets(
  snippets: readonly Snippet[],
  query: string,
): readonly Snippet[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return snippets;
  }

  return snippets.filter((snippet) => {
    return [snippet.name, ...snippet.matches, ...snippet.excludeMatches].some(
      (value) => value.toLocaleLowerCase().includes(normalizedQuery),
    );
  });
}
