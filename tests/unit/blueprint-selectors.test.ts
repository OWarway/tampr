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
      score: 95,
      detail: 'Selector uses a stable unique page marker.',
      recommendation:
        'Ready for normal Blueprint use; test again if the site changes.',
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
      score: 78,
      detail: 'Selector is unique and class-based.',
      recommendation:
        'Good for visual changes; test before high-impact automation.',
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
      score: 40,
      detail:
        'Selector matches 3 elements. Re-pick a more specific target before automating it.',
      recommendation:
        'Choose a unique selector before adding clicks, typing, downloads, or scheduled checks.',
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
      score: 45,
      detail:
        'Selector depends on page position, so layout changes may break it.',
      recommendation:
        'Prefer a data attribute, ID, or unique class before relying on this flow.',
    });
  });

  it('scores missing selectors as immediate re-pick candidates', () => {
    expect(
      assessBlueprintSelector({
        matchCount: 0,
        segmentCount: 1,
        strategy: 'attribute',
        usesNthOfType: false,
      }),
    ).toEqual({
      quality: 'fragile',
      score: 0,
      detail: 'Selector did not match the selected element after generation.',
      recommendation: 'Pick the element again before running this Blueprint.',
    });
  });
});
