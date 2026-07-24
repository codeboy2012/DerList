/**
 * OAuth provider configuration using the arctic library.
 *
 * Provider-agnostic design — adding Discord, Microsoft, etc. later
 * requires only adding a new getter function here and a route handler pair.
 */

import * as arctic from 'arctic';

import { siteConfig } from '@/lib/site-config';

export { arctic };

// ─────────────────────────────────────────────────────────────────────────────
// GitHub
// ─────────────────────────────────────────────────────────────────────────────

let _github: arctic.GitHub | null = null;

export function getGitHub(): arctic.GitHub {
  if (!_github) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set.');
    }
    _github = new arctic.GitHub(clientId, clientSecret, `${siteConfig.url}/auth/github/callback`);
  }
  return _github;
}

export function isGitHubEnabled(): boolean {
  return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

// ─────────────────────────────────────────────────────────────────────────────
// Google
// ─────────────────────────────────────────────────────────────────────────────

let _google: arctic.Google | null = null;

export function getGoogle(): arctic.Google {
  if (!_google) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.');
    }
    _google = new arctic.Google(clientId, clientSecret, `${siteConfig.url}/auth/google/callback`);
  }
  return _google;
}

export function isGoogleEnabled(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
