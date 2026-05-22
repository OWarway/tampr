import { validateWebMatchPattern } from './web-match-patterns';

export type PageRulePresetId = 'page' | 'path' | 'site';

export type PageRulePreset = {
  id: PageRulePresetId;
  label: string;
  pattern: string;
};

export function buildPageRulePresets(
  rawPageUrl: string | undefined,
): PageRulePreset[] {
  if (!rawPageUrl) {
    return [];
  }

  let pageUrl: URL;

  try {
    pageUrl = new URL(rawPageUrl);
  } catch {
    return [];
  }

  if (pageUrl.protocol !== 'http:' && pageUrl.protocol !== 'https:') {
    return [];
  }

  const scheme = pageUrl.protocol.slice(0, -1);
  const path = pageUrl.pathname || '/';
  const host = pageUrl.hostname;

  return normalizePresets([
    {
      id: 'page',
      label: 'Page',
      pattern: `${scheme}://${host}${path}`,
    },
    {
      id: 'path',
      label: 'Path',
      pattern: `${scheme}://${host}${path}*`,
    },
    {
      id: 'site',
      label: 'Site',
      pattern: `*://${host}/*`,
    },
  ]);
}

function normalizePresets(presets: PageRulePreset[]): PageRulePreset[] {
  const normalizedPresets: PageRulePreset[] = [];
  const usedPatterns = new Set<string>();

  for (const preset of presets) {
    const validation = validateWebMatchPattern(preset.pattern);

    if (!validation.ok || usedPatterns.has(validation.pattern)) {
      continue;
    }

    normalizedPresets.push({
      ...preset,
      pattern: validation.pattern,
    });
    usedPatterns.add(validation.pattern);
  }

  return normalizedPresets;
}
