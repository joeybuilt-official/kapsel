import { describe, test, expect } from 'vitest';
import { validateManifest } from './manifest.js';

const validManifest = {
  kapsel: '0.2.0',
  name: '@acme/my-skill',
  version: '1.0.0',
  type: 'skill',
  entry: './dist/index.js',
  capabilities: ['memory:read', 'channel:send', 'connections:stripe'],
  displayName: 'My Skill',
  description: 'Does something useful.',
  author: 'acme',
  license: 'MIT',
};

describe('validateManifest', () => {
  test('accepts a valid manifest', () => {
    const result = validateManifest(validManifest);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity !== 'warning')).toHaveLength(0);
  });

  test('rejects non-object input', () => {
    expect(validateManifest(null).valid).toBe(false);
    expect(validateManifest('string').valid).toBe(false);
    expect(validateManifest(42).valid).toBe(false);
  });

  test('rejects invalid semver for kapsel field', () => {
    const result = validateManifest({ ...validManifest, kapsel: 'not-semver' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'kapsel')).toBe(true);
  });

  test('rejects invalid package name format', () => {
    const cases = ['no-scope', '@/no-name', 'plain'];
    for (const name of cases) {
      const result = validateManifest({ ...validManifest, name });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'name')).toBe(true);
    }
  });

  test('accepts valid scoped names including dots', () => {
    const cases = ['@acme/my-skill', '@my-org/stripe-monitor', '@k/x', '@my.org/tool', '@scope/my.tool'];
    for (const name of cases) {
      const result = validateManifest({ ...validManifest, name });
      expect(result.valid).toBe(true);
    }
  });

  test('rejects invalid extension type', () => {
    const result = validateManifest({ ...validManifest, type: 'widget' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'type')).toBe(true);
  });

  test('accepts all valid extension types', () => {
    const types = ['agent', 'skill', 'channel', 'tool', 'mcp-server'];
    for (const type of types) {
      const result = validateManifest({ ...validManifest, type });
      expect(result.valid).toBe(true);
    }
  });

  test('rejects displayName over 50 chars', () => {
    const result = validateManifest({ ...validManifest, displayName: 'x'.repeat(51) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'displayName')).toBe(true);
  });

  test('accepts displayName at exactly 50 chars', () => {
    const result = validateManifest({ ...validManifest, displayName: 'x'.repeat(50) });
    expect(result.valid).toBe(true);
  });

  test('rejects description over 280 chars', () => {
    const result = validateManifest({ ...validManifest, description: 'x'.repeat(281) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'description')).toBe(true);
  });

  test('accepts description at exactly 280 chars', () => {
    const result = validateManifest({ ...validManifest, description: 'x'.repeat(280) });
    expect(result.valid).toBe(true);
  });

  test('rejects unknown capability tokens', () => {
    const result = validateManifest({ ...validManifest, capabilities: ['memory:read', 'invalid:cap'] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.startsWith('capabilities') && e.severity !== 'warning')).toBe(true);
  });

  test('accepts all standard capability tokens', () => {
    const caps = [
      'memory:read', 'memory:write', 'memory:delete',
      'channel:send', 'channel:send-direct', 'channel:receive',
      'schedule:register', 'schedule:manage',
      'ui:register-widget', 'ui:notify',
      'tasks:create', 'tasks:read', 'tasks:read-all',
      'events:subscribe', 'events:publish',
      'storage:read', 'storage:write',
    ];
    const result = validateManifest({ ...validManifest, capabilities: caps });
    expect(result.valid).toBe(true);
  });

  test('accepts connections:<service> capability tokens', () => {
    const result = validateManifest({ ...validManifest, capabilities: ['connections:stripe', 'connections:github', 'connections:my-service'] });
    expect(result.valid).toBe(true);
  });

  test('host-scoped tokens are valid but emit a warning', () => {
    const result = validateManifest({ ...validManifest, capabilities: ['host:plexo:sprint:trigger'] });
    // Still valid — host-scoped tokens pass format check
    expect(result.valid).toBe(true);
    // But a warning is emitted
    const warn = result.errors.find((e) => e.field.startsWith('capabilities') && e.severity === 'warning');
    expect(warn).toBeDefined();
    expect(warn?.message).toContain('host-scoped');
  });

  test('rejects more than 10 keywords', () => {
    const result = validateManifest({ ...validManifest, keywords: new Array(11).fill('tag') });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'keywords')).toBe(true);
  });

  test('rejects more than 5 screenshots', () => {
    const result = validateManifest({ ...validManifest, screenshots: new Array(6).fill('https://example.com/img.png') });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'screenshots')).toBe(true);
  });

  test('requires mcpServer field for mcp-server type', () => {
    const result = validateManifest({ ...validManifest, type: 'mcp-server' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'mcpServer')).toBe(true);
  });

  test('accepts mcp-server type with mcpServer config', () => {
    const result = validateManifest({
      ...validManifest,
      type: 'mcp-server',
      capabilities: [],
      mcpServer: { transport: 'stdio', command: 'node dist/server.js' },
    });
    expect(result.valid).toBe(true);
  });

  test('accumulates multiple errors', () => {
    const result = validateManifest({ kapsel: 'bad', name: 'bad', version: 'bad', type: 'bad', entry: '', capabilities: 'bad', displayName: '', description: 'ok', author: '', license: '' });
    expect(result.errors.filter((e) => e.severity !== 'warning').length).toBeGreaterThan(3);
  });
});
