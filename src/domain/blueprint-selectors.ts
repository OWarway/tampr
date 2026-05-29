import { z } from 'zod';

export const BLUEPRINT_SELECTOR_STRATEGIES = [
  'id',
  'attribute',
  'class',
  'path',
  'position',
] as const;

export const BLUEPRINT_SELECTOR_QUALITIES = [
  'strong',
  'good',
  'fragile',
] as const;

export type BlueprintSelectorStrategy =
  (typeof BLUEPRINT_SELECTOR_STRATEGIES)[number];

export type BlueprintSelectorQuality =
  (typeof BLUEPRINT_SELECTOR_QUALITIES)[number];

export type BlueprintSelectorMeta = {
  matchCount: number;
  segmentCount: number;
  strategy: BlueprintSelectorStrategy;
  usesNthOfType: boolean;
};

export type BlueprintSelectorAssessment = {
  detail: string;
  quality: BlueprintSelectorQuality;
  recommendation: string;
  score: number;
};

export const BlueprintSelectorMetaSchema = z.object({
  matchCount: z.number().int().nonnegative(),
  segmentCount: z.number().int().positive(),
  strategy: z.enum(BLUEPRINT_SELECTOR_STRATEGIES),
  usesNthOfType: z.boolean(),
});

export function assessBlueprintSelector(
  meta: BlueprintSelectorMeta,
): BlueprintSelectorAssessment {
  if (meta.matchCount === 0) {
    return {
      quality: 'fragile',
      score: 0,
      detail: 'Selector did not match the selected element after generation.',
      recommendation: 'Pick the element again before running this Blueprint.',
    };
  }

  if (meta.matchCount > 1) {
    return {
      quality: 'fragile',
      score: Math.max(20, 55 - meta.matchCount * 5),
      detail: `Selector matches ${meta.matchCount} elements. Re-pick a more specific target before automating it.`,
      recommendation:
        'Choose a unique selector before adding clicks, typing, downloads, or scheduled checks.',
    };
  }

  if (meta.usesNthOfType || meta.strategy === 'position') {
    return {
      quality: 'fragile',
      score: 45,
      detail:
        'Selector depends on page position, so layout changes may break it.',
      recommendation:
        'Prefer a data attribute, ID, or unique class before relying on this flow.',
    };
  }

  if (meta.strategy === 'id' || meta.strategy === 'attribute') {
    return {
      quality: 'strong',
      score: meta.strategy === 'id' ? 96 : 95,
      detail: 'Selector uses a stable unique page marker.',
      recommendation:
        'Ready for normal Blueprint use; test again if the site changes.',
    };
  }

  if (meta.strategy === 'class' && meta.segmentCount <= 2) {
    return {
      quality: 'good',
      score: 78,
      detail: 'Selector is unique and class-based.',
      recommendation:
        'Good for visual changes; test before high-impact automation.',
    };
  }

  return {
    quality: 'good',
    score: 68,
    detail: 'Selector is unique but depends on an element path.',
    recommendation:
      'Usable, but re-pick if the page layout changes or automation becomes flaky.',
  };
}
