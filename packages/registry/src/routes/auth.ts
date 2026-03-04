import type { Request, Response, Router as RouterType } from 'express';
import { Router } from 'express';
import { verifyGitHubToken, issuePublisherToken } from '../auth.js';

export function authRouter(): RouterType {
  const router = Router();

  router.post('/token', async (req: Request, res: Response) => {
    const { githubToken, scope } = req.body as { githubToken?: string; scope?: string };

    if (!githubToken || !scope) {
      res.status(400).json({ error: 'githubToken and scope are required' });
      return;
    }

    if (!/^[a-z0-9-]+$/.test(scope)) {
      res.status(400).json({ error: 'scope must be lowercase alphanumeric and hyphens' });
      return;
    }

    const user = await verifyGitHubToken(githubToken);
    if (!user) {
      res.status(401).json({ error: 'Invalid GitHub token' });
      return;
    }

    const token = await issuePublisherToken(scope, user.id);
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    res.status(200).json({ token, scope, expiresAt });
  });

  return router;
}
