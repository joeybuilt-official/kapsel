/**
 * Kapsel Channel Extension Interface
 * Corresponds to §2.3 and §9.2 of the Kapsel Protocol Specification
 */

import type { InboundMessage, OutboundMessage } from './messages.js';
import type { KapselSDK } from './sdk.js';

export interface ChannelSendResult {
  delivered: boolean;
  messageId?: string;
  error?: string;
}

export interface ChannelHealthResult {
  healthy: boolean;
  reason?: string;
  lastCheckedAt?: number;
}

/**
 * Interface that channel extensions must implement.
 */
export interface ChannelExtension {
  activate(sdk: KapselSDK): Promise<void>;
  receive(message: InboundMessage, sdk: KapselSDK): Promise<void>;
  send(message: OutboundMessage, sdk: KapselSDK): Promise<ChannelSendResult>;
  health(sdk: KapselSDK): Promise<ChannelHealthResult>;
  /** Optional. Called when a DM pairing code has been generated for an unknown sender. */
  onPairingRequest?(senderId: string, pairingCode: string, sdk: KapselSDK): Promise<void>;
  deactivate?(): Promise<void>;
}
