import { describe, expect, it } from 'vitest';

import {
  assessBlueprintNodeSafety,
  highestBlueprintSafetyLevel,
} from '../../src/domain/blueprints/safety';
import {
  BlueprintNodeSchema,
  type BlueprintNode,
  type BlueprintNodeType,
} from '../../src/domain/blueprints/recipe';

describe('blueprint safety', () => {
  it('does not warn for CSS-only nodes', () => {
    expect(
      assessBlueprintNodeSafety(BlueprintNodeSchema.parse(node('hide', '.ad'))),
    ).toEqual([]);
  });

  it('flags risky click labels and hidden click targets', () => {
    const issues = assessBlueprintNodeSafety(
      BlueprintNodeSchema.parse({
        ...node('click', 'button.checkout'),
        label: 'Submit order',
        requireVisible: false,
      }),
    );

    expect(issues.map((issue) => issue.code)).toEqual([
      'click-review',
      'click-hidden',
      'risky-click-copy',
    ]);
    expect(highestBlueprintSafetyLevel(issues)).toBe('danger');
  });

  it('flags sensitive set-value selectors and empty values', () => {
    const issues = assessBlueprintNodeSafety(
      BlueprintNodeSchema.parse({
        ...node('set-value', 'input[name="password"]'),
        value: '',
      }),
    );

    expect(issues.map((issue) => issue.code)).toContain('empty-value');
    expect(issues.map((issue) => issue.code)).toContain('sensitive-field');
    expect(highestBlueprintSafetyLevel(issues)).toBe('danger');
  });

  it('flags selector drift and JSON filenames', () => {
    const selectorIssues = assessBlueprintNodeSafety(
      BlueprintNodeSchema.parse({
        ...node('extract-text', 'main > div:nth-of-type(2)', {
          matchCount: 2,
          strategy: 'position',
          usesNthOfType: true,
        }),
        variableName: 'dealText',
      }),
    );
    const downloadIssues = assessBlueprintNodeSafety(
      BlueprintNodeSchema.parse({
        ...node('download-json', 'body'),
        filename: 'tampr-output.txt',
      }),
    );

    expect(selectorIssues.map((issue) => issue.code)).toEqual([
      'multiple-selector-matches',
      'positional-selector',
    ]);
    expect(downloadIssues).toEqual([
      {
        code: 'json-extension',
        level: 'warning',
        message: 'JSON download filenames should end with .json.',
      },
    ]);
  });
});

function node(
  type: BlueprintNodeType,
  selector: string,
  selectorMeta: Partial<BlueprintNode['selectorMeta']> = {},
) {
  return {
    id: `${type}-node`,
    enabled: true,
    selector,
    selectorMeta: {
      matchCount: 1,
      segmentCount: 1,
      strategy: 'attribute' as const,
      usesNthOfType: false,
      ...selectorMeta,
    },
    type,
  };
}
