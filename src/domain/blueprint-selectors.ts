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
      detail: 'Selector did not match the selected element after generation.',
    };
  }

  if (meta.matchCount > 1) {
    return {
      quality: 'fragile',
      detail: `Selector matches ${meta.matchCount} elements. Re-pick a more specific target before automating it.`,
    };
  }

  if (meta.usesNthOfType || meta.strategy === 'position') {
    return {
      quality: 'fragile',
      detail:
        'Selector depends on page position, so layout changes may break it.',
    };
  }

  if (meta.strategy === 'id' || meta.strategy === 'attribute') {
    return {
      quality: 'strong',
      detail: 'Selector uses a stable unique page marker.',
    };
  }

  if (meta.strategy === 'class' && meta.segmentCount <= 2) {
    return {
      quality: 'good',
      detail: 'Selector is unique and class-based.',
    };
  }

  return {
    quality: 'good',
    detail: 'Selector is unique but depends on an element path.',
  };
}
