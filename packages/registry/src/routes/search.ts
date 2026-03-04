import type { Request, Response, Router as RouterType } from 'express';
import { Router } from 'express';
import { queries } from '../db.js';

export function searchRouter(): RouterType {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const q = String(req.query['q'] ?? '');
    const type = String(req.query['type'] ?? '');
    const limit = Math.min(Number(req.query['limit'] ?? 20), 100);
    const offset = Number(req.query['offset'] ?? 0);

    const rows = queries.searchExtensions.all(q, q, q, q, type, type, limit, offset);
    const { count } = queries.countSearch.get(q, q, q, q, type, type) ?? { count: 0 };

    const results = rows.map((ext) => ({
      name: ext.name,
      type: ext.type,
      displayName: ext.display_name,
      description: ext.description,
      latestVersion: ext.latest,
      keywords: JSON.parse(ext.keywords) as string[],
      downloads: {
        weekly: queries.weeklyDownloads.get(ext.name)?.count ?? 0,
      },
    }));

    res.json({ total: count, results });
  });

  return router;
}
