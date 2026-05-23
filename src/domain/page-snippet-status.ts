import type { Snippet } from './snippets';
import { webMatchPatternMatchesUrl } from './web-match-patterns';

export type PageSnippetMatch = {
  enabled: boolean;
  id: string;
  name: string;
  rule: string;
};

export type PageSnippetStatus = {
  enabledMatches: PageSnippetMatch[];
  pageUrl: string;
  savedMatches: PageSnippetMatch[];
};

export function derivePageSnippetStatus(
  snippets: readonly Snippet[],
  pageUrl: string,
): PageSnippetStatus {
  const savedMatches: PageSnippetMatch[] = [];
  const enabledMatches: PageSnippetMatch[] = [];

  for (const snippet of snippets) {
    const rule = firstPageMatchRule(snippet, pageUrl);

    if (!rule || isPageExcluded(snippet, pageUrl)) {
      continue;
    }

    const match = {
      enabled: snippet.enabled,
      id: snippet.id,
      name: snippet.name,
      rule,
    };

    savedMatches.push(match);

    if (snippet.enabled) {
      enabledMatches.push(match);
    }
  }

  return {
    enabledMatches,
    pageUrl,
    savedMatches,
  };
}

function firstPageMatchRule(
  snippet: Snippet,
  pageUrl: string,
): string | undefined {
  return snippet.matches.find((pattern) =>
    webMatchPatternMatchesUrl(pattern, pageUrl),
  );
}

function isPageExcluded(snippet: Snippet, pageUrl: string): boolean {
  return snippet.excludeMatches.some((pattern) =>
    webMatchPatternMatchesUrl(pattern, pageUrl),
  );
}
