import { z } from 'zod';

const SUPPORTED_SCHEMES = new Set(['*', 'http', 'https']);
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

export type WebMatchPatternValidation =
  | {
      ok: true;
      pattern: string;
    }
  | {
      ok: false;
      message: string;
    };

export function validateWebMatchPattern(
  rawPattern: string,
): WebMatchPatternValidation {
  const pattern = rawPattern.trim();

  if (!pattern) {
    return invalidPattern('Match patterns cannot be empty.');
  }

  if (/\s/.test(pattern)) {
    return invalidPattern('Match patterns cannot contain whitespace.');
  }

  const separatorIndex = pattern.indexOf('://');

  if (separatorIndex < 1) {
    return invalidPattern('Use a web match pattern such as *://example.com/*.');
  }

  const scheme = pattern.slice(0, separatorIndex).toLowerCase();
  const hostAndPath = pattern.slice(separatorIndex + 3);
  const pathIndex = hostAndPath.indexOf('/');

  if (!SUPPORTED_SCHEMES.has(scheme)) {
    return invalidPattern(
      'Only http, https, and wildcard web schemes run in V1.',
    );
  }

  if (pathIndex < 1) {
    return invalidPattern('Match patterns need a host and a slash path.');
  }

  const host = hostAndPath.slice(0, pathIndex).toLowerCase();
  const path = hostAndPath.slice(pathIndex);

  if (!isValidHostPattern(host)) {
    return invalidPattern(
      'Use a host, *, or a subdomain wildcard such as *.example.com.',
    );
  }

  return {
    ok: true,
    pattern: `${scheme}://${host}${path}`,
  };
}

export function webMatchPatternMatchesUrl(
  rawPattern: string,
  rawUrl: string,
): boolean {
  const validation = validateWebMatchPattern(rawPattern);

  if (!validation.ok) {
    return false;
  }

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const pattern = splitValidatedPattern(validation.pattern);

  if (!pattern) {
    return false;
  }

  return (
    schemeMatches(pattern.scheme, url.protocol.slice(0, -1)) &&
    hostMatches(pattern.host, url.hostname.toLowerCase()) &&
    wildcardMatches(pattern.path, `${url.pathname}${url.search}`)
  );
}

export const WebMatchPatternSchema = z
  .string()
  .transform((pattern, context) => {
    const validation = validateWebMatchPattern(pattern);

    if (!validation.ok) {
      context.addIssue({
        code: 'custom',
        message: validation.message,
      });

      return z.NEVER;
    }

    return validation.pattern;
  });

function invalidPattern(message: string): WebMatchPatternValidation {
  return { ok: false, message };
}

function isValidHostPattern(host: string): boolean {
  if (host === '*' || host === 'localhost') {
    return true;
  }

  if (host.includes(':')) {
    return false;
  }

  if (host.startsWith('*.')) {
    return isValidExactHost(host.slice(2));
  }

  if (host.includes('*')) {
    return false;
  }

  return isValidExactHost(host);
}

function isValidExactHost(host: string): boolean {
  if (!host) {
    return false;
  }

  return host.split('.').every((label) => HOST_LABEL.test(label));
}

type ValidatedPatternParts = {
  host: string;
  path: string;
  scheme: string;
};

function splitValidatedPattern(
  pattern: string,
): ValidatedPatternParts | undefined {
  const separatorIndex = pattern.indexOf('://');
  const hostAndPath = pattern.slice(separatorIndex + 3);
  const pathIndex = hostAndPath.indexOf('/');

  if (separatorIndex < 1 || pathIndex < 1) {
    return undefined;
  }

  return {
    scheme: pattern.slice(0, separatorIndex),
    host: hostAndPath.slice(0, pathIndex),
    path: hostAndPath.slice(pathIndex),
  };
}

function schemeMatches(patternScheme: string, urlScheme: string): boolean {
  return patternScheme === '*' || patternScheme === urlScheme;
}

function hostMatches(patternHost: string, urlHost: string): boolean {
  if (patternHost === '*') {
    return true;
  }

  if (patternHost.startsWith('*.')) {
    const rootHost = patternHost.slice(2);

    return urlHost === rootHost || urlHost.endsWith(`.${rootHost}`);
  }

  return patternHost === urlHost;
}

function wildcardMatches(pattern: string, value: string): boolean {
  const escaped = pattern
    .split('*')
    .map((segment) => segment.replace(/[\\^$+?.()|[\]{}]/g, '\\$&'))
    .join('.*');

  return new RegExp(`^${escaped}$`).test(value);
}
