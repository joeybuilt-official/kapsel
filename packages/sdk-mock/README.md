# @kapsel/sdk-mock

In-memory mock host for testing [Kapsel](https://kapsel.sh) extensions without a running host.

## Installation

```bash
pnpm add -D @kapsel/sdk-mock
```

## Usage

```typescript
import { createMockSdk, triggerSchedule, getSentMessages, invokeTool } from '@kapsel/sdk-mock';
import { activate } from '../src/index.js';
import { describe, test, expect, beforeEach } from 'vitest';

describe('stripe-monitor', () => {
  let sdk: ReturnType<typeof createMockSdk>;

  beforeEach(async () => {
    sdk = createMockSdk({
      connections: {
        stripe: { type: 'api_key', data: { key: 'sk_test_mock' } },
      },
    });
    await activate(sdk);
  });

  test('registers get_mrr tool', () => {
    expect(sdk._state.tools.has('get_mrr')).toBe(true);
  });

  test('registers daily_report schedule', () => {
    expect(sdk._state.schedules.has('daily_report')).toBe(true);
  });

  test('sends MRR message when daily_report runs', async () => {
    await triggerSchedule(sdk, 'daily_report');
    const messages = getSentMessages(sdk);
    expect(messages[0]?.text).toMatch(/MRR/);
  });

  test('get_mrr tool returns mrr value', async () => {
    const result = await invokeTool<{ mrr: number }>(sdk, 'get_mrr', { currency: 'usd' });
    expect(typeof result.mrr).toBe('number');
  });
});
```

## API

### `createMockSdk(options?)`

Creates a mock SDK. Accepts optional `connections` (pre-configured credentials) and `host` overrides.

Returns a `KapselSDK` instance with an extra `_state` property for inspecting what happened.

### Helpers

| Function | What it does |
|----------|-------------|
| `triggerSchedule(sdk, name)` | Run a registered cron job immediately |
| `invokeTool(sdk, name, params)` | Call a registered tool |
| `getWidgetData(sdk, name, config?)` | Fetch widget data |
| `emitEvent(sdk, topic, payload)` | Simulate a host event |
| `getSentMessages(sdk)` | Get all sent channel messages |
| `getPublishedEvents(sdk)` | Get all published events |
| `resetState(sdk)` | Clear messages/storage/memory between tests |

### Inspecting State

```typescript
sdk._state.tools        // Map of registered tools
sdk._state.schedules    // Map of registered schedules  
sdk._state.widgets      // Map of registered widgets
sdk._state.sentMessages // Array of all channel.send() calls
sdk._state.memory       // Map of memory entries
sdk._state.storage      // Map of storage entries
```
