/**
 * Integration tests for the registry extensions routes.
 * Uses an in-memory SQLite DB via KAPSEL_DB_PATH=:memory: env override.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Must set before importing db.ts
process.env['KAPSEL_DB_PATH'] = ':memory:';
process.env['KAPSEL_TARBALLS_DIR'] = '/tmp/kapsel-test-tarballs';
process.env['KAPSEL_REGISTRY_URL'] = 'http://localhost:3000';

// Mock auth so we don't need real GitHub tokens
vi.mock('../auth.js', () => ({
  verifyPublisherToken: vi.fn(async (token: string) => {
    if (token === 'valid-acme-token') return { scope: 'acme', githubId: 'acme-user' };
    if (token === 'valid-other-token') return { scope: 'other', githubId: 'other-user' };
    return null;
  }),
}));

// Mock manifest validation to always pass for test payloads
vi.mock('@kapsel/sdk', () => ({
  validateManifest: vi.fn(() => ({ valid: true, errors: [] })),
}));

import { extensionsRouter } from './extensions.js';

const app = express();
app.use(express.json());
app.use('/extensions', extensionsRouter());

/** Helper: publish a version and return the response */
async function publish(scope: string, name: string, version: string, token = 'valid-acme-token') {
  const manifest = {
    kapsel: '0.2.0',
    name: `@${scope}/${name}`,
    version,
    type: 'skill',
    entry: './dist/index.js',
    capabilities: [],
    displayName: `${name} display`,
    description: 'test extension',
    author: scope,
    license: 'MIT',
  };
  return request(app)
    .put(`/extensions/${scope}/${name}/${version}`)
    .set('Authorization', `Bearer ${token}`)
    .set('X-Kapsel-Manifest', JSON.stringify(manifest))
    .set('Content-Type', 'application/octet-stream')
    .send(Buffer.from('fake-tarball'));
}

describe('PUT /extensions/:scope/:name/:version', () => {
  it('publishes a new version', async () => {
    const res = await publish('acme', 'stripe-monitor', '1.0.0');
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('@acme/stripe-monitor');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.shasum).toMatch(/^sha256:/);
  });

  it('returns 409 for duplicate version', async () => {
    await publish('acme', 'dup-test', '1.0.0');
    const res = await publish('acme', 'dup-test', '1.0.0');
    expect(res.status).toBe(409);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .put('/extensions/acme/no-auth/1.0.0')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('x'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when token scope does not match URL scope', async () => {
    // 'valid-acme-token' has scope 'acme', trying to publish to 'other'
    const res = await request(app)
      .put('/extensions/other/some-ext/1.0.0')
      .set('Authorization', 'Bearer valid-acme-token')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('x'));
    expect(res.status).toBe(403);
  });
});

describe('GET /extensions/:scope/:name', () => {
  beforeAll(async () => {
    await publish('acme', 'list-test', '1.0.0');
    await publish('acme', 'list-test', '1.1.0');
  });

  it('returns extension metadata with versions array', async () => {
    const res = await request(app).get('/extensions/acme/list-test');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('@acme/list-test');
    expect(res.body.latestVersion).toBe('1.1.0');
    expect(res.body.versions).toContain('1.0.0');
    expect(res.body.versions).toContain('1.1.0');
    expect(typeof res.body.deprecated).toBe('boolean');
  });

  it('returns 404 for unknown extension', async () => {
    const res = await request(app).get('/extensions/acme/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('GET /extensions/:scope/:name/:version', () => {
  beforeAll(async () => {
    await publish('acme', 'ver-test', '2.0.0');
  });

  it('returns version metadata including deprecated fields', async () => {
    const res = await request(app).get('/extensions/acme/ver-test/2.0.0');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('2.0.0');
    expect(res.body.deprecated).toBe(false);
    expect(res.body.deprecationReason).toBeNull();
    expect(res.body.shasum).toMatch(/^sha256:/);
  });

  it('returns 404 for unknown version', async () => {
    const res = await request(app).get('/extensions/acme/ver-test/9.9.9');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /extensions/:scope/:name/:version — deprecation', () => {
  beforeAll(async () => {
    await publish('acme', 'dep-test', '1.0.0');
    await publish('acme', 'dep-test', '1.0.1');
  });

  it('deprecates a version with a reason', async () => {
    const res = await request(app)
      .patch('/extensions/acme/dep-test/1.0.0')
      .set('Authorization', 'Bearer valid-acme-token')
      .json({ deprecated: true, deprecationReason: 'Critical bug — upgrade to 1.0.1' });
    expect(res.status).toBe(200);
    expect(res.body.deprecated).toBe(true);
    expect(res.body.deprecationReason).toBe('Critical bug — upgrade to 1.0.1');
  });

  it('GET version reflects deprecated: true after PATCH', async () => {
    const res = await request(app).get('/extensions/acme/dep-test/1.0.0');
    expect(res.status).toBe(200);
    expect(res.body.deprecated).toBe(true);
    expect(res.body.deprecationReason).toBe('Critical bug — upgrade to 1.0.1');
  });

  it('un-deprecates a version and clears the reason', async () => {
    const res = await request(app)
      .patch('/extensions/acme/dep-test/1.0.0')
      .set('Authorization', 'Bearer valid-acme-token')
      .json({ deprecated: false });
    expect(res.status).toBe(200);
    expect(res.body.deprecated).toBe(false);
    expect(res.body.deprecationReason).toBeNull();
  });

  it('GET version reflects deprecated: false after un-deprecation', async () => {
    const res = await request(app).get('/extensions/acme/dep-test/1.0.0');
    expect(res.body.deprecated).toBe(false);
    expect(res.body.deprecationReason).toBeNull();
  });

  it('non-latest version deprecation does not affect GET extension metadata deprecated field', async () => {
    // Deprecate 1.0.0 (not latest, latest is 1.0.1)
    await request(app)
      .patch('/extensions/acme/dep-test/1.0.0')
      .set('Authorization', 'Bearer valid-acme-token')
      .json({ deprecated: true, deprecationReason: 'old' });

    const extRes = await request(app).get('/extensions/acme/dep-test');
    // Latest (1.0.1) is not deprecated, so extension-level deprecated should be false
    expect(extRes.body.deprecated).toBe(false);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .patch('/extensions/acme/dep-test/1.0.0')
      .json({ deprecated: true });
    expect(res.status).toBe(401);
  });

  it('returns 403 when token scope does not match', async () => {
    const res = await request(app)
      .patch('/extensions/acme/dep-test/1.0.0')
      .set('Authorization', 'Bearer valid-other-token')
      .json({ deprecated: true });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent version', async () => {
    const res = await request(app)
      .patch('/extensions/acme/dep-test/9.9.9')
      .set('Authorization', 'Bearer valid-acme-token')
      .json({ deprecated: true });
    expect(res.status).toBe(404);
  });

  it('returns 422 when deprecated field is missing', async () => {
    const res = await request(app)
      .patch('/extensions/acme/dep-test/1.0.0')
      .set('Authorization', 'Bearer valid-acme-token')
      .json({ deprecationReason: 'oops, forgot the flag' });
    expect(res.status).toBe(422);
  });
});
