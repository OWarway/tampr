import { describe, expect, it } from 'vitest';

import { assessBlueprintSelector } from '../../src/domain/blueprint-selectors';

describe('blueprint selector assessment', () => {
  it('treats unique stable attributes as strong selectors', () => {
    expect(
      assessBlueprintSelector({
        matchCount: 1,
        segmentCount: 1,
        strategy: 'attribute',
        usesNthOfType: false,
      }),
    ).toEqual({
      quality: 'strong',
      detail: 'Selector uses a stable unique page marker.',
    });
  });

  it('treats unique class selectors as good selectors', () => {
    expect(
      assessBlueprintSelector({
        matchCount: 1,
        segmentCount: 1,
        strategy: 'class',
        usesNthOfType: false,
      }),
    ).toEqual({
      quality: 'good',
      detail: 'Selector is unique and class-based.',
    });
  });

  it('warns when the selector matches multiple elements', () => {
    expect(
      assessBlueprintSelector({
        matchCount: 3,
        segmentCount: 1,
        strategy: 'class',
        usesNthOfType: false,
      }),
    ).toEqual({
      quality: 'fragile',
      detail:
        'Selector matches 3 elements. Re-pick a more specific target before automating it.',
    });
  });

  it('warns when the selector depends on page position', () => {
    expect(
      assessBlueprintSelector({
        matchCount: 1,
        segmentCount: 4,
        strategy: 'position',
        usesNthOfType: true,
      }),
    ).toEqual({
      quality: 'fragile',
      detail:
        'Selector depends on page position, so layout changes may break it.',
    });
  });
});
