import type { Snippet } from './snippets';

export function upsertSnippet(
  snippets: readonly Snippet[],
  snippet: Snippet,
): Snippet[] {
  const existingIndex = snippets.findIndex(
    (candidate) => candidate.id === snippet.id,
  );

  if (existingIndex < 0) {
    return [...snippets, snippet];
  }

  return snippets.map((candidate) =>
    candidate.id === snippet.id ? snippet : candidate,
  );
}

export function removeSnippet(
  snippets: readonly Snippet[],
  snippetId: string,
): Snippet[] {
  return snippets.filter((snippet) => snippet.id !== snippetId);
}
