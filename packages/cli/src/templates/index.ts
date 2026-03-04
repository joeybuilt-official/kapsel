import type { ExtensionType, CapabilityToken } from '@kapsel/sdk';

interface TemplateContext {
  name: string;
  displayName: string;
  description: string;
  author: string;
  scope: string;
  pkgName: string;
}

interface ExtensionTemplate {
  defaultCapabilities: CapabilityToken[];
  entryTemplate: (ctx: TemplateContext) => string;
}

export const TEMPLATES: Record<ExtensionType, ExtensionTemplate> = {
  skill: {
    defaultCapabilities: ['memory:read', 'memory:write', 'channel:send', 'schedule:register', 'storage:read', 'storage:write'],
    entryTemplate: ({ displayName }: TemplateContext) => `import type { KapselSDK } from '@kapsel/sdk';

export async function activate(sdk: KapselSDK): Promise<void> {

  sdk.registerTool({
    name: 'example_tool',
    description: 'An example tool from ${displayName}.',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input value' },
      },
      required: ['input'],
    },
    handler: async (params, context) => {
      const { input } = params as { input: string };
      // TODO: implement
      return { result: input };
    },
  });

  sdk.registerSchedule({
    name: 'hourly_check',
    schedule: '0 * * * *',
    handler: async () => {
      // TODO: implement scheduled task
      await sdk.channel.send({ text: '${displayName}: scheduled check ran' });
    },
  });

  sdk.registerWidget({
    name: 'status_card',
    displayName: '${displayName} Status',
    displayType: 'status',
    refreshInterval: 60,
    dataHandler: async () => {
      return { status: 'ok', label: '${displayName}' };
    },
  });
}

export async function deactivate(): Promise<void> {
  // Clean up external connections if any
}
`,
  },

  agent: {
    defaultCapabilities: ['memory:read', 'memory:write', 'tasks:create', 'tasks:read', 'channel:send', 'events:subscribe', 'events:publish', 'storage:read', 'storage:write'],
    entryTemplate: ({ displayName }: TemplateContext) => `import type {
  KapselSDK,
  TaskSummary,
  Task,
  Plan,
  StepResult,
} from '@kapsel/sdk';

export async function activate(sdk: KapselSDK): Promise<void> {
  // Register any tools, subscriptions, or schedules this agent needs
}

export async function shouldActivate(task: TaskSummary, sdk: KapselSDK) {
  // Return true + confidence if this agent should handle the task
  const relevant = task.type === 'ops'; // TODO: adjust task types
  return {
    activate: relevant,
    confidence: relevant ? 0.8 : 0,
    reason: relevant ? '${displayName} handles ops tasks' : undefined,
  };
}

export async function plan(task: Task, sdk: KapselSDK): Promise<Plan> {
  return {
    goalRestatement: `${displayName}: ${task.title}`,
    steps: [
      {
        index: 0,
        description: 'TODO: first step',
        tools: [],
        dependsOnPrevious: false,
        isOneWayDoor: false,
      },
    ],
    confidence: 0.8,
    oneWayDoors: [],
    risks: [],
  };
}

export async function executeStep(
  task: Task,
  plan: Plan,
  stepIndex: number,
  sdk: KapselSDK
): Promise<StepResult> {
  const step = plan.steps[stepIndex];
  if (!step) throw new Error(`Step ${stepIndex} not found in plan`);

  // TODO: implement step execution
  return {
    stepIndex,
    success: true,
    summary: `Completed step ${stepIndex}: ${step.description}`,
    toolCalls: [],
    canContinue: true,
  };
}

export async function deactivate(): Promise<void> {}
`,
  },

  channel: {
    defaultCapabilities: ['channel:receive', 'channel:send', 'storage:read', 'storage:write'],
    entryTemplate: ({ displayName }: TemplateContext) => `import type { KapselSDK, InboundMessage, OutboundMessage } from '@kapsel/sdk';

export async function activate(sdk: KapselSDK): Promise<void> {
  // Initialize connection to external messaging service
  // Set up webhooks or polling here
}

export async function receive(message: InboundMessage, sdk: KapselSDK): Promise<void> {
  // Called by host when an inbound message arrives from the external service
  // The host routes it to the task router after this returns
  console.log('${displayName} received:', message.text);
}

export async function send(message: OutboundMessage, sdk: KapselSDK) {
  // Called by host to deliver an outbound message via this channel
  // TODO: implement delivery to external service
  console.log('${displayName} sending:', message.text);
  return { delivered: true };
}

export async function health(sdk: KapselSDK) {
  // TODO: check if the channel connection is active
  return { healthy: true };
}

export async function deactivate(): Promise<void> {
  // Disconnect from external service
}
`,
  },

  tool: {
    defaultCapabilities: ['storage:read', 'storage:write'],
    entryTemplate: ({ displayName }: TemplateContext) => `import type { KapselSDK } from '@kapsel/sdk';

export async function activate(sdk: KapselSDK): Promise<void> {

  sdk.registerTool({
    name: 'example_function',
    description: '${displayName} — describe what this does in one sentence.',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'The input to process' },
      },
      required: ['input'],
    },
    hints: {
      hasSideEffects: false,
      idempotent: true,
    },
    handler: async (params, context) => {
      const { input } = params as { input: string };
      // TODO: implement
      return { output: input };
    },
  });
}
`,
  },

  'mcp-server': {
    defaultCapabilities: [],
    entryTemplate: ({ displayName, name }: TemplateContext) => `import type { KapselSDK } from '@kapsel/sdk';

/**
 * ${displayName}
 * Bridges an MCP server into the Kapsel runtime.
 * Configure the server in kapsel.json under the "mcpServer" key.
 */
export async function activate(sdk: KapselSDK): Promise<void> {
  // MCP server lifecycle is managed by the host.
  // The host reads mcpServer.transport and mcpServer.command/url from kapsel.json.
  // All MCP tools are automatically registered into the Tool Registry.
  //
  // Use this activate() for any setup logic that runs before the MCP server starts.
  console.log('${name} MCP bridge activated. Host version:', sdk.host.kapselVersion);
}

export async function deactivate(): Promise<void> {
  // Cleanup if needed before host terminates the MCP server process.
}
`,
  },
};
