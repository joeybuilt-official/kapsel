/**
 * @kapsel/registry
 * Reference Kapsel registry server.
 *
 * Implements the Registry Protocol from §12 of the Kapsel specification.
 */

import express from 'express';
import { authRouter } from './routes/auth.js';
import { extensionsRouter } from './routes/extensions.js';
import { searchRouter } from './routes/search.js';

const PORT = Number(process.env['PORT'] ?? 3000);
const REGISTRY_NAME = process.env['KAPSEL_REGISTRY_NAME'] ?? 'kapsel-registry';
const KAPSEL_VERSION = '0.2.0';
const SERVER_VERSION = '0.2.0';

const app = express();

app.use(express.json());

// Health check (§12.1)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    kapselVersion: KAPSEL_VERSION,
    name: REGISTRY_NAME,
    version: SERVER_VERSION,
  });
});

// Routes
app.use('/auth', authRouter());
app.use('/extensions', extensionsRouter());
app.use('/search', searchRouter());

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`[kapsel-registry] Listening on port ${PORT}`);
  console.log(`[kapsel-registry] Health: http://localhost:${PORT}/health`);
});

export { app };
