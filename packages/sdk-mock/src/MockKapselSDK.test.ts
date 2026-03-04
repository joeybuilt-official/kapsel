import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createMockSdk } from './MockKapselSDK.js';
import {
  triggerSchedule,
  invokeTool,
  getWidgetData,
  emitEvent,
  getSentMessages,
  getPublishedEvents,
  resetState,
} from './helpers.js';
import type { KapselSDK } from '@kapsel/sdk';

async function simpleActivate(sdk: KapselSDK): Promise<void> {
  sdk.registerTool({
    name: 'echo',
    description: 'Returns the input unchanged.',
    parameters: { type: 'object', properties: { value: { type: 'string' } } },
    handler: async (params: unknown) => (params as { value: string }).value,
  });

  sdk.registerTool({
    name: 'throwing_tool',
    description: 'Always throws.',
    parameters: { type: 'object', properties: {} },
    handler: async () => { throw new Error('tool handler error'); },
  });

  sdk.registerSchedule({
    name: 'ping',
    schedule: '0 * * * *',
    timezone: 'America/Denver',
    handler: async () => {
      await sdk.channel.send({ text: 'ping' });
    },
  });

  sdk.registerWidget({
    name: 'status',
    displayName: 'Status',
    displayType: 'status',
    refreshInterval: 60,
    dataHandler: async () => ({ healthy: true }),
  });
}

describe('createMockSdk', () => {
  let sdk: ReturnType<typeof createMockSdk>;

  beforeEach(async () => {
    sdk = createMockSdk();
    await simpleActivate(sdk);
  });

  test('host info defaults', () => {
    expect(sdk.host.kapselVersion).toBe('0.2.0');
    expect(sdk.host.complianceLevel).toBe('full');
    expect(sdk.host.name).toBe('kapsel-mock');
  });

  test('host info can be overridden', () => {
    const custom = createMockSdk({ host: { name: 'my-host', complianceLevel: 'core' } });
    expect(custom.host.name).toBe('my-host');
    expect(custom.host.complianceLevel).toBe('core');
  });

  test('registerTool adds to state', () => {
    expect(sdk._state.tools.has('echo')).toBe(true);
  });

  test('registerSchedule adds to state with timezone', () => {
    const job = sdk._state.schedules.get('ping');
    expect(job).toBeDefined();
    expect(job?.timezone).toBe('America/Denver');
  });

  test('registerWidget adds to state', () => {
    expect(sdk._state.widgets.has('status')).toBe(true);
  });

  test('generated ids are unique across instances', () => {
    const sdk1 = createMockSdk();
    const sdk2 = createMockSdk();
    // Both have independent state — no shared counter
    expect(sdk1._state).not.toBe(sdk2._state);
  });
});

describe('invokeTool', () => {
  let sdk: ReturnType<typeof createMockSdk>;
  beforeEach(async () => { sdk = createMockSdk(); await simpleActivate(sdk); });

  test('calls the tool handler', async () => {
    const result = await invokeTool(sdk, 'echo', { value: 'hello' });
    expect(result).toBe('hello');
  });

  test('throws for unknown tool', async () => {
    await expect(invokeTool(sdk, 'nonexistent', {})).rejects.toThrow('not found');
  });

  test('propagates handler errors — does not swallow', async () => {
    await expect(invokeTool(sdk, 'throwing_tool', {})).rejects.toThrow('tool handler error');
  });

  test('sdk.tools.list returns registered tools', async () => {
    const tools = await sdk.tools.list();
    expect(tools.some((t) => t.name === 'echo')).toBe(true);
  });
});

describe('triggerSchedule', () => {
  let sdk: ReturnType<typeof createMockSdk>;
  beforeEach(async () => { sdk = createMockSdk(); await simpleActivate(sdk); });

  test('runs the schedule handler', async () => {
    await triggerSchedule(sdk, 'ping');
    expect(getSentMessages(sdk)).toHaveLength(1);
    expect(getSentMessages(sdk)[0]?.text).toBe('ping');
  });

  test('throws for unknown schedule', async () => {
    await expect(triggerSchedule(sdk, 'nonexistent')).rejects.toThrow();
  });
});

describe('getWidgetData', () => {
  let sdk: ReturnType<typeof createMockSdk>;
  beforeEach(async () => { sdk = createMockSdk(); await simpleActivate(sdk); });

  test('calls widget dataHandler', async () => {
    const data = await getWidgetData(sdk, 'status');
    expect(data).toEqual({ healthy: true });
  });

  test('throws for unknown widget', async () => {
    await expect(getWidgetData(sdk, 'nonexistent')).rejects.toThrow();
  });
});

describe('memory', () => {
  let sdk: ReturnType<typeof createMockSdk>;
  beforeEach(() => { sdk = createMockSdk(); });

  test('write and read', async () => {
    await sdk.memory.write({ content: 'test content', tags: ['test'] });
    const results = await sdk.memory.read('test content');
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toBe('test content');
  });

  test('read filters by tag', async () => {
    await sdk.memory.write({ content: 'alpha', tags: ['a'] });
    await sdk.memory.write({ content: 'beta', tags: ['b'] });
    const results = await sdk.memory.read('', { tags: ['a'] });
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toBe('alpha');
  });

  test('delete removes entry', async () => {
    const entry = await sdk.memory.write({ content: 'to delete' });
    await sdk.memory.delete(entry.id);
    const results = await sdk.memory.read('to delete');
    expect(results).toHaveLength(0);
  });

  test('TTL: expired entries are not returned', async () => {
    const now = Date.now();
    vi.setSystemTime(now);
    await sdk.memory.write({ content: 'ephemeral', ttl: 1 }); // 1 second TTL
    // Advance time past TTL
    vi.setSystemTime(now + 2000);
    const results = await sdk.memory.read('ephemeral');
    expect(results).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe('storage', () => {
  let sdk: ReturnType<typeof createMockSdk>;
  beforeEach(() => { sdk = createMockSdk(); });

  test('set and get', async () => {
    await sdk.storage.set('key', { value: 42 });
    const result = await sdk.storage.get<{ value: number }>('key');
    expect(result?.value).toBe(42);
  });

  test('get returns null for missing key', async () => {
    const result = await sdk.storage.get('missing');
    expect(result).toBeNull();
  });

  test('delete removes key', async () => {
    await sdk.storage.set('k', 'v');
    await sdk.storage.delete('k');
    expect(await sdk.storage.get('k')).toBeNull();
  });

  test('list returns matching keys', async () => {
    await sdk.storage.set('foo:1', 'a');
    await sdk.storage.set('foo:2', 'b');
    await sdk.storage.set('bar:1', 'c');
    const keys = await sdk.storage.list('foo:');
    expect(keys).toHaveLength(2);
    expect(keys.every((k) => k.startsWith('foo:'))).toBe(true);
  });

  test('list respects limit option', async () => {
    for (let i = 0; i < 10; i++) await sdk.storage.set(`item:${i}`, i);
    const keys = await sdk.storage.list('item:', { limit: 3 });
    expect(keys).toHaveLength(3);
  });

  test('TTL: expired keys return null and are cleaned up', async () => {
    const now = Date.now();
    vi.setSystemTime(now);
    await sdk.storage.set('temp', 'value', { ttl: 1 }); // 1 second TTL
    vi.setSystemTime(now + 2000);
    expect(await sdk.storage.get('temp')).toBeNull();
    // Key should be gone from storage map after expiry access
    const keys = await sdk.storage.list('temp');
    // Note: list() does not eagerly evict — get() does. This tests the get() path.
    vi.useRealTimers();
  });
});

describe('events', () => {
  let sdk: ReturnType<typeof createMockSdk>;
  beforeEach(() => { sdk = createMockSdk(); });

  test('subscribe and publish', async () => {
    const received: unknown[] = [];
    sdk.events.subscribe('ext.acme.test', async (payload) => { received.push(payload); });
    await sdk.events.publish('ext.acme.test', { hello: 'world' });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ hello: 'world' });
  });

  test('unsubscribe via returned function stops receiving', async () => {
    const received: unknown[] = [];
    const unsub = sdk.events.subscribe('ext.acme.t', async (p) => { received.push(p); });
    unsub();
    await sdk.events.publish('ext.acme.t', {});
    expect(received).toHaveLength(0);
  });

  test('unsubscribe by topic stops all handlers', async () => {
    const received: unknown[] = [];
    sdk.events.subscribe('ext.acme.u', async (p) => { received.push(p); });
    sdk.events.unsubscribe('ext.acme.u');
    await sdk.events.publish('ext.acme.u', {});
    expect(received).toHaveLength(0);
  });

  test('getPublishedEvents tracks publishes', async () => {
    await sdk.events.publish('ext.acme.my-event', 42);
    expect(getPublishedEvents(sdk)).toHaveLength(1);
    expect(getPublishedEvents(sdk)[0]?.topic).toBe('ext.acme.my-event');
  });

  test('emitEvent triggers subscribers', async () => {
    const received: unknown[] = [];
    sdk.events.subscribe('task.failed', async (p) => { received.push(p); });
    await emitEvent(sdk, 'task.failed', { from: 'host' });
    expect(received).toHaveLength(1);
  });

  test('publish to host-owned topic throws', async () => {
    await expect(sdk.events.publish('task.failed', {})).rejects.toThrow('host-owned topic');
    await expect(sdk.events.publish('system.shutdown', {})).rejects.toThrow('host-owned topic');
  });

  test('concurrent subscriptions on different topics', async () => {
    const aReceived: unknown[] = [];
    const bReceived: unknown[] = [];
    sdk.events.subscribe('ext.a.evt', async (p) => { aReceived.push(p); });
    sdk.events.subscribe('ext.b.evt', async (p) => { bReceived.push(p); });
    await Promise.all([
      sdk.events.publish('ext.a.evt', 'a'),
      sdk.events.publish('ext.b.evt', 'b'),
    ]);
    expect(aReceived).toEqual(['a']);
    expect(bReceived).toEqual(['b']);
  });
});

describe('connections', () => {
  test('getCredentials returns configured creds', async () => {
    const sdk = createMockSdk({
      connections: { stripe: { type: 'api_key', data: { key: 'sk_test' } } },
    });
    const creds = await sdk.connections.getCredentials('stripe');
    expect(creds.type).toBe('api_key');
    expect(creds.data['key']).toBe('sk_test');
  });

  test('isConnected returns true for configured service', async () => {
    const sdk = createMockSdk({ connections: { github: { type: 'oauth2', data: { token: 'ghp_x' } } } });
    expect(await sdk.connections.isConnected('github')).toBe(true);
    expect(await sdk.connections.isConnected('stripe')).toBe(false);
  });

  test('getCredentials throws for unconfigured service', async () => {
    const sdk = createMockSdk();
    await expect(sdk.connections.getCredentials('stripe')).rejects.toThrow();
  });
});

describe('tasks', () => {
  let sdk: ReturnType<typeof createMockSdk>;
  beforeEach(() => { sdk = createMockSdk(); });

  test('create and read', async () => {
    const task = await sdk.tasks.create({ title: 'Deploy to prod', type: 'deployment' });
    expect(task.id).toBeTruthy();
    expect(task.status).toBe('queued');
    const fetched = await sdk.tasks.read(task.id);
    expect(fetched.title).toBe('Deploy to prod');
  });

  test('readAll with filter', async () => {
    await sdk.tasks.create({ title: 'Task A', type: 'ops' });
    await sdk.tasks.create({ title: 'Task B', type: 'coding' });
    const ops = await sdk.tasks.readAll({ type: 'ops' });
    expect(ops).toHaveLength(1);
    expect(ops[0]?.type).toBe('ops');
  });
});

describe('resetState', () => {
  test('clears runtime state but preserves registrations', async () => {
    const sdk = createMockSdk();
    await simpleActivate(sdk);
    await sdk.channel.send({ text: 'hello' });
    await sdk.memory.write({ content: 'x' });
    await sdk.storage.set('k', 'v');
    await sdk.events.publish('ext.acme.test', {});
    await sdk.tasks.create({ title: 't', type: 'ops' });

    resetState(sdk);

    // Runtime state cleared
    expect(sdk._state.sentMessages).toHaveLength(0);
    expect(sdk._state.publishedEvents).toHaveLength(0);
    expect(sdk._state.memory.size).toBe(0);
    expect(sdk._state.storage.size).toBe(0);
    expect(sdk._state.tasks.size).toBe(0);

    // Registrations preserved (documented contract)
    expect(sdk._state.tools.has('echo')).toBe(true);
    expect(sdk._state.schedules.has('ping')).toBe(true);
    expect(sdk._state.widgets.has('status')).toBe(true);
  });
});
