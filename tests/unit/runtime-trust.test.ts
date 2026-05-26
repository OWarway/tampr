import { describe, expect, it } from 'vitest';

import {
  runtimeActionNotice,
  runtimeBadgeLabel,
  workspaceTrustItems,
} from '../../src/shared/runtime-trust';
import type { RuntimeStatus } from '../../src/runtime/runtime-status';

describe('runtime trust copy', () => {
  it('summarizes unavailable User Scripts setup', () => {
    const runtime: RuntimeStatus = {
      state: 'user-scripts-unavailable',
      registrations: 0,
      skipped: [],
      errors: [],
    };

    expect(runtimeBadgeLabel(runtime)).toBe('Setup');
    expect(runtimeActionNotice(runtime)).toBe(
      'Enable User Scripts for Tampr in Chrome extension details before snippets can run.',
    );
  });

  it('prioritizes runtime sync errors in action notices', () => {
    const runtime: RuntimeStatus = {
      state: 'sync-error',
      registrations: 0,
      skipped: [],
      errors: [{ registrationId: 'tampr-style-1', message: 'Bad source' }],
    };

    expect(runtimeBadgeLabel(runtime)).toBe('Error');
    expect(runtimeActionNotice(runtime, 'host-access')).toBe(
      'Runtime sync failed: Bad source',
    );
  });

  it('builds workspace trust items from runtime state', () => {
    const items = workspaceTrustItems({
      snippets: [],
      runtime: {
        state: 'ready',
        registrations: 0,
        skipped: [{ snippetId: 'one', reason: 'invalid-matches' }],
        errors: [],
      },
    });

    expect(items.map((item) => item.value)).toEqual([
      '0 local snippets',
      'Ready',
      '1 rule issue',
    ]);
    expect(items[2]?.tone).toBe('danger');
  });
});
