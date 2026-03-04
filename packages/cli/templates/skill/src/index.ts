/**
 * Skill extension entry point.
 * Replace this with your actual implementation.
 */

import type { KapselSDK } from '@kapsel/sdk';

export async function activate(sdk: KapselSDK): Promise<void> {
  // Register a tool
  sdk.registerTool({
    name: 'example_tool',
    description: 'An example tool. Replace with your actual implementation.',
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input for the tool.',
        },
      },
      required: ['input'],
    },
    handler: async (params, context) => {
      const { input } = params as { input: string };
      return { result: `Processed: ${input}` };
    },
  });

  // Register a cron job
  sdk.registerSchedule({
    name: 'example_schedule',
    schedule: '0 9 * * *', // 9am daily
    handler: async () => {
      await sdk.channel.send({ text: 'Daily check-in from example_schedule.' });
    },
  });
}

export async function deactivate(): Promise<void> {
  // Clean up any external connections here
}
