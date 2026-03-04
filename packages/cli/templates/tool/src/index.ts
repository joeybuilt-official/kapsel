/**
 * Tool extension entry point.
 * A single stateless function exposed to the host's Tool Registry.
 */

import type { KapselSDK, InvokeContext } from '@kapsel/sdk';

export async function activate(sdk: KapselSDK): Promise<void> {
  sdk.registerTool({
    name: 'example_tool',
    description: 'Replace with your tool description. Max 500 characters.',
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'The input to process.',
        },
      },
      required: ['input'],
    },
    hints: {
      hasSideEffects: false,
      idempotent: true,
    },
    handler: async (params: unknown, context: InvokeContext) => {
      const { input } = params as { input: string };
      // Replace with your actual implementation
      return { result: input };
    },
  });
}

export async function deactivate(): Promise<void> {}
