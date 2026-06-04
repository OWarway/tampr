import { describe, expect, it } from 'vitest';

import {
  formatBlueprintExtractListFieldsInput,
  parseBlueprintExtractListFieldsInput,
} from '../../src/domain/blueprints/extract-list-fields';

describe('blueprint extract-list field input', () => {
  it('parses text and attribute field lines', () => {
    expect(
      parseBlueprintExtractListFieldsInput(
        [
          'title = h2',
          'price = .price',
          'url = a[data-testid="deal"] @href',
        ].join('\n'),
      ),
    ).toEqual([
      {
        name: 'title',
        selector: 'h2',
        source: 'text',
      },
      {
        name: 'price',
        selector: '.price',
        source: 'text',
      },
      {
        attribute: 'href',
        name: 'url',
        selector: 'a[data-testid="deal"]',
        source: 'attribute',
      },
    ]);
  });

  it('formats field lines for editing', () => {
    expect(
      formatBlueprintExtractListFieldsInput([
        {
          name: 'title',
          selector: 'h2',
          source: 'text',
        },
        {
          attribute: 'href',
          name: 'url',
          selector: 'a',
          source: 'attribute',
        },
      ]),
    ).toBe(['title = h2', 'url = a @href'].join('\n'));
  });
});
