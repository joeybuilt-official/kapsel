/**
 * Channel: Telegram
 * Bidirectional Telegram messaging via Bot API long polling.
 * Demonstrates: channel extension contract, pairing flow, message routing.
 */

import type {
  KapselSDK,
  InboundMessage,
  OutboundMessage,
  ChannelSendResult,
  ChannelHealthResult,
} from '@kapsel/sdk';

interface TelegramConfig {
  botToken: string;
  allowedChatIds?: string[];
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string; first_name: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
}

let config: TelegramConfig = { botToken: '' };
let pollInterval: ReturnType<typeof setInterval> | null = null;
let lastUpdateId = 0;
let sdk: KapselSDK;

export async function activate(sdkInstance: KapselSDK): Promise<void> {
  sdk = sdkInstance;
  const storedOffset = await sdk.storage.get<number>('last_update_id');
  if (storedOffset) lastUpdateId = storedOffset;
}

export async function receive(
  message: InboundMessage,
  _sdk: KapselSDK
): Promise<void> {
  // Message has been routed to us by the host.
  // In a polling-based channel, messages come via the poll loop below.
  // In a webhook-based deployment, the host would call this directly.
}

export async function send(
  message: OutboundMessage,
  _sdk: KapselSDK
): Promise<ChannelSendResult> {
  if (!config.botToken) {
    return { delivered: false, error: 'Bot token not configured' };
  }

  // Get stored chat IDs (users who have paired)
  const pairedChats = await sdk.storage.get<string[]>('paired_chat_ids') ?? [];
  if (pairedChats.length === 0) {
    return { delivered: false, error: 'No paired Telegram users' };
  }

  const results = await Promise.allSettled(
    pairedChats.map((chatId) => sendToChat(chatId, message.text))
  );

  const delivered = results.some((r) => r.status === 'fulfilled');
  return { delivered };
}

export async function health(_sdk: KapselSDK): Promise<ChannelHealthResult> {
  if (!config.botToken) return { healthy: false, reason: 'Bot token not configured' };

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.botToken}/getMe`
    );
    const data = await res.json() as { ok: boolean; result?: { username: string } };
    if (data.ok) {
      return { healthy: true, reason: `Connected as @${data.result?.username ?? 'unknown'}` };
    }
    return { healthy: false, reason: 'Telegram API returned error' };
  } catch (err) {
    return { healthy: false, reason: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function onPairingRequest(
  senderId: string,
  pairingCode: string,
  _sdk: KapselSDK
): Promise<void> {
  await sendToChat(
    senderId,
    `🔗 Pairing request. Enter this code to connect:\n\n<code>${pairingCode}</code>\n\nExpires in 10 minutes.`
  );
}

export async function onConfigUpdate(newConfig: unknown): Promise<void> {
  config = { ...config, ...(newConfig as Partial<TelegramConfig>) };
  if (pollInterval) {
    clearInterval(pollInterval);
    startPolling();
  }
}

export async function deactivate(): Promise<void> {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function startPolling(): void {
  pollInterval = setInterval(async () => {
    try {
      await poll();
    } catch { /* Swallow poll errors */ }
  }, 2000);
}

async function poll(): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${config.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`
  );
  if (!res.ok) return;

  const data = await res.json() as { ok: boolean; result: TelegramUpdate[] };
  if (!data.ok || data.result.length === 0) return;

  for (const update of data.result) {
    lastUpdateId = update.update_id;
    if (update.message?.text) {
      const msg = update.message;
      const chatId = String(msg.chat.id);

      // Build inbound message and call receive
      const inbound: InboundMessage = {
        id: String(msg.message_id),
        text: msg.text ?? '',
        senderId: chatId,
        channelId: 'telegram',
        timestamp: msg.date * 1000,
        raw: msg,
      };

      await sdk.channel.send({ text: '' }); // Placeholder: real impl routes via host
      void inbound; // In real impl, host calls receive() via webhook or poll handler
    }
  }

  await sdk.storage.set('last_update_id', lastUpdateId);
}

async function sendToChat(chatId: string, text: string): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${config.botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    }
  );
  if (!res.ok) throw new Error(`Telegram sendMessage failed: ${res.status}`);
}
