import { describe, expect, it } from 'vitest';

import {
  validateWebMatchPattern,
  WebMatchPatternSchema,
} from '../../src/domain/web-match-patterns';

describe('validateWebMatchPattern', () => {
  it('normalizes supported web match patterns', () => {
    expect(validateWebMatchPattern(' HTTPS://*.Example.com/path/* ')).toEqual({
      ok: true,
      pattern: 'https://*.example.com/path/*',
    });
  });

  it('rejects unsupported schemes and host wildcards', () => {
    expect(validateWebMatchPattern('file:///*')).toMatchObject({ ok: false });
    expect(validateWebMatchPattern('*://exa*mple.com/*')).toMatchObject({
      ok: false,
    });
  });

  it('validates through the runtime schema boundary', () => {
    expect(WebMatchPatternSchema.parse('http://localhost/*')).toBe(
      'http://localhost/*',
    );
    expect(() => WebMatchPatternSchema.parse('example.com/*')).toThrow();
  });
});
