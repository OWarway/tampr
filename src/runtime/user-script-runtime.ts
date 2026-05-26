import type { Snippet } from '../domain/snippets';
import { validateWebMatchPattern } from '../domain/web-match-patterns';
import {
  TAMPR_BADGE_HIT_MESSAGE,
  TAMPR_DOWNLOAD_MESSAGE,
} from '../shared/tampr-api';
import type {
  RuntimeRegistrationError,
  RuntimeSkip,
  RuntimeStatus,
} from './runtime-status';

const REGISTRATION_PREFIX = 'tampr-';

export type RuntimeRegistration = {
  id: string;
  matches: string[];
  excludeMatches: string[];
  js: string[];
  runAt: Snippet['runAt'];
  world: Snippet['world'];
};

export type UserScriptsApi = {
  configureWorld?(): Promise<void>;
  getScripts(): Promise<Array<{ id: string }>>;
  register(scripts: RuntimeRegistration[]): Promise<void>;
  unregister(filter: { ids: string[] }): Promise<void>;
};

export type MatchAccessReader = (matchPattern: string) => Promise<boolean>;

type SyncUserScriptsInput = {
  hasMatchAccess: MatchAccessReader;
  snippets: readonly Snippet[];
  userScripts: UserScriptsApi;
};

export async function syncUserScripts({
  hasMatchAccess,
  snippets,
  userScripts,
}: SyncUserScriptsInput): Promise<RuntimeStatus> {
  await userScripts.configureWorld?.();

  const existingScripts = await userScripts.getScripts();
  const previousIds = existingScripts
    .map((script) => script.id)
    .filter((id) => id.startsWith(REGISTRATION_PREFIX));

  if (previousIds.length > 0) {
    await userScripts.unregister({ ids: previousIds });
  }

  const skipped: RuntimeSkip[] = [];
  const registrations: RuntimeRegistration[] = [];

  for (const snippet of snippets) {
    const nextRegistrations = await planSnippetRegistrations(
      snippet,
      hasMatchAccess,
      skipped,
    );

    registrations.push(...nextRegistrations);
  }

  const errors: RuntimeRegistrationError[] = [];
  let registeredCount = 0;

  for (const registration of registrations) {
    try {
      await userScripts.register([registration]);
      registeredCount += 1;
    } catch (error) {
      errors.push({
        registrationId: registration.id,
        message: toErrorMessage(error),
      });
    }
  }

  return {
    state: errors.length > 0 ? 'sync-error' : 'ready',
    registrations: registeredCount,
    skipped,
    errors,
  };
}

export async function syncChromeUserScripts(
  snippets: readonly Snippet[],
): Promise<RuntimeStatus> {
  const userScripts = createChromeUserScriptsApi();

  if (!userScripts) {
    return unavailableStatus();
  }

  try {
    return await syncUserScripts({
      snippets,
      userScripts,
      hasMatchAccess: hasChromeMatchAccess,
    });
  } catch {
    return unavailableStatus();
  }
}

async function planSnippetRegistrations(
  snippet: Snippet,
  hasMatchAccess: MatchAccessReader,
  skipped: RuntimeSkip[],
): Promise<RuntimeRegistration[]> {
  if (!snippet.enabled) {
    skipped.push({ snippetId: snippet.id, reason: 'disabled' });
    return [];
  }

  const matches = getValidPatterns(snippet.matches);

  if (matches.length !== snippet.matches.length || matches.length === 0) {
    skipped.push({ snippetId: snippet.id, reason: 'invalid-matches' });
    return [];
  }

  const grantedMatches = await filterGrantedMatches(matches, hasMatchAccess);

  if (grantedMatches.length === 0) {
    skipped.push({ snippetId: snippet.id, reason: 'host-access' });
    return [];
  }

  const excludeMatches = getValidPatterns(snippet.excludeMatches);
  const registrations = buildSnippetRegistrations(
    snippet,
    grantedMatches,
    excludeMatches,
  );

  if (registrations.length === 0) {
    skipped.push({ snippetId: snippet.id, reason: 'no-code' });
  }

  return registrations;
}

export function buildSnippetRegistrations(
  snippet: Snippet,
  matches: string[],
  excludeMatches: string[],
): RuntimeRegistration[] {
  const registrations: RuntimeRegistration[] = [];
  const hasCss = snippet.css.trim().length > 0;
  const hasJs = snippet.js.trim().length > 0;

  if (hasCss || hasJs) {
    registrations.push({
      id: heartbeatRegistrationId(snippet.id),
      matches,
      excludeMatches,
      js: [buildBadgeHeartbeatSource(snippet.id)],
      runAt: snippet.runAt,
      world: 'USER_SCRIPT',
    });
  }

  if (hasCss) {
    registrations.push({
      id: styleRegistrationId(snippet.id),
      matches,
      excludeMatches,
      js: [buildStyleBridgeSource(snippet.id, snippet.css)],
      runAt: snippet.runAt,
      world: 'USER_SCRIPT',
    });
  }

  if (hasJs) {
    registrations.push({
      id: scriptRegistrationId(snippet.id),
      matches,
      excludeMatches,
      js:
        snippet.world === 'USER_SCRIPT'
          ? [buildScriptApiBridgeSource(snippet.id), snippet.js]
          : [snippet.js],
      runAt: snippet.runAt,
      world: snippet.world,
    });
  }

  return registrations;
}

export function buildBadgeHeartbeatSource(snippetId: string): string {
  return `(() => {
  try {
    const result = chrome.runtime.sendMessage({
      type: ${JSON.stringify(TAMPR_BADGE_HIT_MESSAGE)},
      snippetId: ${JSON.stringify(snippetId)},
    });

    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  } catch {
    // Badge updates are best-effort and must never affect user snippets.
  }
})();`;
}

export function buildScriptApiBridgeSource(snippetId: string): string {
  return `(() => {
  const type = ${JSON.stringify(TAMPR_DOWNLOAD_MESSAGE)};
  const snippetId = ${JSON.stringify(snippetId)};
  const download = async (payload) => {
    const response = await chrome.runtime.sendMessage({
      type,
      snippetId,
      payload,
    });

    if (!response || response.ok !== true) {
      throw new Error(
        response && typeof response.error === 'string'
          ? response.error
          : 'Tampr download failed.',
      );
    }

    return { downloadId: response.downloadId };
  };

  Object.defineProperty(globalThis, 'Tampr', {
    configurable: true,
    value: Object.freeze({ download }),
  });
})();`;
}

export function buildStyleBridgeSource(snippetId: string, css: string): string {
  const styleId = `tampr-style-${snippetId}`;

  return `(() => {
  const id = ${JSON.stringify(styleId)};
  const css = ${JSON.stringify(css)};
  const previous = document.getElementById(id);
  if (previous) previous.remove();
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  (document.head || document.documentElement).append(style);
})();`;
}

function createChromeUserScriptsApi(): UserScriptsApi | undefined {
  if (!chrome.userScripts) {
    return undefined;
  }

  return {
    configureWorld: async () => {
      await chrome.userScripts.configureWorld({ messaging: true });
    },
    getScripts: async () => chrome.userScripts.getScripts(),
    register: async (scripts) => {
      await chrome.userScripts.register(
        scripts.map((script) => ({
          id: script.id,
          matches: script.matches,
          excludeMatches: script.excludeMatches,
          js: script.js.map((code) => ({ code })),
          runAt: script.runAt,
          world: script.world,
        })),
      );
    },
    unregister: async (filter) => chrome.userScripts.unregister(filter),
  };
}

async function hasChromeMatchAccess(matchPattern: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [matchPattern] });
}

async function filterGrantedMatches(
  patterns: string[],
  hasMatchAccess: MatchAccessReader,
): Promise<string[]> {
  const access = await Promise.all(
    patterns.map(async (pattern) => ({
      granted: await hasMatchAccess(pattern),
      pattern,
    })),
  );

  return access.filter(({ granted }) => granted).map(({ pattern }) => pattern);
}

function getValidPatterns(patterns: readonly string[]): string[] {
  const validPatterns: string[] = [];

  for (const pattern of patterns) {
    const validation = validateWebMatchPattern(pattern);

    if (validation.ok) {
      validPatterns.push(validation.pattern);
    }
  }

  return validPatterns;
}

function styleRegistrationId(snippetId: string): string {
  return `${REGISTRATION_PREFIX}style-${snippetId}`;
}

function heartbeatRegistrationId(snippetId: string): string {
  return `${REGISTRATION_PREFIX}heartbeat-${snippetId}`;
}

function scriptRegistrationId(snippetId: string): string {
  return `${REGISTRATION_PREFIX}script-${snippetId}`;
}

function unavailableStatus(): RuntimeStatus {
  return {
    state: 'user-scripts-unavailable',
    registrations: 0,
    skipped: [],
    errors: [],
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
