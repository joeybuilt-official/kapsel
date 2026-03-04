/**
 * Publisher authentication via GitHub OAuth tokens.
 * The registry verifies tokens with the GitHub API and issues its own signed JWTs.
 */

import { SignJWT, jwtVerify } from 'jose';
import { db, queries } from './db.js';

const JWT_SECRET = process.env['KAPSEL_JWT_SECRET'];
if (!JWT_SECRET) {
  console.warn('[auth] KAPSEL_JWT_SECRET not set. Using insecure default. Set this in production.');
}
const secret = new TextEncoder().encode(JWT_SECRET ?? 'kapsel-dev-secret-do-not-use-in-prod');

const TOKEN_TTL_HOURS = 24;

export interface PublisherToken {
  scope: string;
  githubId: string;
}

export async function verifyGitHubToken(githubToken: string): Promise<{ id: string; login: string } | null> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'kapsel-registry/0.2.0',
      },
    });
    if (!res.ok) return null;
    const user = await res.json() as { id: number; login: string };
    return { id: String(user.id), login: user.login };
  } catch {
    return null;
  }
}

export async function issuePublisherToken(scope: string, githubId: string): Promise<string> {
  // Store publisher mapping
  queries.upsertPublisher.run(scope, githubId);

  const expiresAt = Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000;

  return new SignJWT({ scope, githubId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_HOURS}h`)
    .sign(secret);
}

export async function verifyPublisherToken(token: string): Promise<PublisherToken | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload['scope'] !== 'string' || typeof payload['githubId'] !== 'string') {
      return null;
    }
    return { scope: payload['scope'], githubId: payload['githubId'] };
  } catch {
    return null;
  }
}
