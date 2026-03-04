# @kapsel/sdk

TypeScript SDK for building [Kapsel](https://kapsel.sh)-compatible extensions.

## What This Package Is

This package provides:
- All TypeScript types and interfaces for the Kapsel protocol
- The `KapselSDK` interface your extension receives in `activate()`
- Manifest validation utilities
- Event topic constants and helpers

This package does **not** provide a runtime. The runtime is the host (e.g. Plexo). When you ship an extension, the host injects a real `KapselSDK` instance.

## Installation

```bash
pnpm add @kapsel/sdk
# or
npm install @kapsel/sdk
```

## Usage

### Skill Extension

```typescript
import type { KapselSDK } from '@kapsel/sdk';

export async function activate(sdk: KapselSDK): Promise<void> {
  sdk.registerTool({
    name: 'get_mrr',
    description: 'Returns current Monthly Recurring Revenue from Stripe.',
    parameters: {
      type: 'object',
      properties: {
        currency: { type: 'string', default: 'usd' },
      },
    },
    handler: async (params, context) => {
      const creds = await sdk.connections.getCredentials('stripe');
      // ... call Stripe API
      return { mrr: 105420, currency: 'usd' };
    },
  });

  sdk.registerSchedule({
    name: 'daily_report',
    schedule: '0 8 * * *',
    handler: async () => {
      const result = await sdk.tools.invoke('get_mrr', {});
      await sdk.channel.send({ text: `Daily MRR: $${(result.mrr / 100).toFixed(2)}` });
    },
  });
}
```

### Agent Extension

```typescript
import type { KapselSDK, TaskSummary, Task } from '@kapsel/sdk';

export async function activate(sdk: KapselSDK): Promise<void> {}

export async function shouldActivate(task: TaskSummary, sdk: KapselSDK) {
  const isDevOps = task.type === 'deployment' || task.type === 'ops';
  return { activate: isDevOps, confidence: isDevOps ? 0.9 : 0 };
}

export async function plan(task: Task, sdk: KapselSDK) {
  return {
    goalRestatement: `Deploy and verify: ${task.title}`,
    steps: [
      { index: 0, description: 'Run deployment', tools: ['deploy_service'], dependsOnPrevious: false, isOneWayDoor: true },
      { index: 1, description: 'Verify health', tools: ['check_health'], dependsOnPrevious: true, isOneWayDoor: false },
    ],
    confidence: 0.85,
    oneWayDoors: [{ stepIndex: 0, type: 'service_restart' as const, description: 'Restarts the service' }],
  };
}
```

### Validating a Manifest

```typescript
import { validateManifest } from '@kapsel/sdk';
import manifest from './kapsel.json' assert { type: 'json' };

const result = validateManifest(manifest);
if (!result.valid) {
  console.error('Manifest errors:', result.errors);
}
```

## See Also

- [@kapsel/sdk-mock](../sdk-mock) — test your extension without a running host
- [@kapsel/cli](../cli) — scaffold, build, and publish extensions
- [Specification](../../specification/kapsel-protocol.md) — full protocol spec
