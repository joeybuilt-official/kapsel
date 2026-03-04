import { describe, test, expect, beforeEach } from 'vitest';
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
import type { KapselSDK, InvokeContext } from '@kapsel/sdk';

async function simpleActivate(sdk: KapselSDK): Promise<void> {
  sdk.registerTool({
    name: 'echo',
    description: 'Returns the input unchanged.',
    parameters: { type: 'object', properties: { value: { type: 'string' } } },
    handler: async (params: unknown) => (params as { value: string }).value,
  });

  sdk.registerSchedule({
    name: 'ping',
    schedule: '0 * * * *',
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

  test('registerSchedule adds to state', () => {
    expect(sdk._state.schedules.has('ping')).toBe(true);
  });

  test('registerWidget adds to state', () => {
    expect(sdk._state.widgets.has('status')).toBe(true);
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
    await expect(invokeTool(sdk, 'nonexistent', {})).rejects.toThrow();
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
});

describe('events', () => {
  let sdk: ReturnType<typeof createMockSdk>;
  beforeEach(() => { sdk = createMockSdk(); });

  test('subscribe and publish', async () => {
    const received: unknown[] = [];
    sdk.events.subscribe('test.topic', async (payload) => { received.push(payload); });
    await sdk.events.publish('test.topic', { hello: 'world' });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ hello: 'world' });
  });

  test('unsubscribe stops receiving', async () => {
    const received: unknown[] = [];
    sdk.events.subscribe('t', async (p) => { received.push(p); });
    sdk.events.unsubscribe('t');
    await sdk.events.publish('t', {});
    expect(received).toHaveLength(0);
  });

  test('getPublishedEvents tracks publishes', async () => {
    await sdk.events.publish('my.event', 42);
    expect(getPublishedEvents(sdk)).toHaveLength(1);
    expect(getPublishedEvents(sdk)[0]?.topic).toBe('my.event');
  });

  test('emitEvent triggers subscribers', async () => {
    const received: unknown[] = [];
    sdk.events.subscribe('host.event', async (p) => { received.push(p); });
    await emitEvent(sdk, 'host.event', { from: 'host' });
    expect(received).toHaveLength(1);
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
  test('clears messages, events, memory, storage, tasks', async () => {
    const sdk = createMockSdk();
    await sdk.channel.send({ text: 'hello' });
    await sdk.memory.write({ content: 'x' });
    await sdk.storage.set('k', 'v');
    await sdk.events.publish('e', {});
    await sdk.tasks.create({ title: 't', type: 'ops' });

    resetState(sdk);

    expect(sdk._state.sentMessages).toHaveLength(0);
    expect(sdk._state.publishedEvents).toHaveLength(0);
    expect(sdk._state.memory.size).toBe(0);
    expect(sdk._state.storage.size).toBe(0);
    expect(sdk._state.tasks.size).toBe(0);
  });
});
