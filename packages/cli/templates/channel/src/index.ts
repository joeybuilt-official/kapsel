/**
 * Channel extension entry point.
 * Replace with your actual messaging adapter implementation.
 */

import type {
  KapselSDK,
  InboundMessage,
  OutboundMessage,
  ChannelSendResult,
  ChannelHealthResult,
} from '@kapsel/sdk';

export async function activate(sdk: KapselSDK): Promise<void> {
  // Initialize connection to your messaging service.
  // Store any necessary state in sdk.storage.
}

export async function receive(
  message: InboundMessage,
  sdk: KapselSDK
): Promise<void> {
  // Called by host when an inbound message arrives.
  // Route it to the task system or process directly.
}

export async function send(
  message: OutboundMessage,
  sdk: KapselSDK
): Promise<ChannelSendResult> {
  // Deliver the message to your service.
  // Return { delivered: true } on success.
  return { delivered: false, error: 'Not implemented' };
}

export async function health(sdk: KapselSDK): Promise<ChannelHealthResult> {
  // Return whether this channel can currently send/receive.
  return { healthy: false, reason: 'Not configured' };
}

export async function deactivate(): Promise<void> {
  // Clean up connections, webhooks, etc.
}
