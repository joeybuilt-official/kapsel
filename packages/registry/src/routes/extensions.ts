import type { Request, Response, Router as RouterType } from 'express';
import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { db, queries } from '../db.js';
import { verifyPublisherToken } from '../auth.js';
import { validateManifest } from '@kapsel/sdk';

const TARBALLS_DIR = process.env['KAPSEL_TARBALLS_DIR'] ?? path.join(process.cwd(), 'data', 'tarballs');
fs.mkdirSync(TARBALLS_DIR, { recursive: true });

const REGISTRY_URL = process.env['KAPSEL_REGISTRY_URL'] ?? 'http://localhost:3000';

export function extensionsRouter(): RouterType {
  const router = Router();

  // GET /extensions/:scope/:name
  router.get('/:scope/:name', (req: Request, res: Response) => {
    const { scope, name } = req.params as { scope: string; name: string };
    const fullName = `@${scope}/${name}`;
    const ext = queries.getExtension.get(fullName);
    if (!ext) { res.status(404).json({ error: 'Extension not found' }); return; }

    const versions = queries.getAllVersions.all(fullName).map((r) => r.version);
    const weekly = queries.weeklyDownloads.get(fullName)?.count ?? 0;
    const total = queries.totalDownloads.get(fullName)?.count ?? 0;

    res.json({
      name: ext.name,
      type: ext.type,
      displayName: ext.display_name,
      description: ext.description,
      author: ext.author,
      license: ext.license,
      latestVersion: ext.latest,
      versions,
      keywords: JSON.parse(ext.keywords) as string[],
      downloads: { weekly, total },
    });
  });

  // GET /extensions/:scope/:name/:version
  router.get('/:scope/:name/:version', (req: Request, res: Response) => {
    const { scope, name, version } = req.params as { scope: string; name: string; version: string };
    const fullName = `@${scope}/${name}`;
    const row = queries.getVersion.get(fullName, version);
    if (!row) { res.status(404).json({ error: 'Version not found' }); return; }

    res.json({
      name: fullName,
      version: row.version,
      manifest: JSON.parse(row.manifest) as unknown,
      tarballUrl: `${REGISTRY_URL}/extensions/${scope}/${name}/${version}.tar.gz`,
      publishedAt: row.published_at,
      shasum: row.shasum,
    });
  });

  // GET /extensions/:scope/:name/:version.tar.gz
  router.get('/:scope/:name/:version.tar.gz', (req: Request, res: Response) => {
    const { scope, name } = req.params as { scope: string; name: string };
    const version = (req.params as Record<string, string>)['version'] ?? '';
    const fullName = `@${scope}/${name}`;
    const row = queries.getVersion.get(fullName, version);
    if (!row) { res.status(404).json({ error: 'Not found' }); return; }

    if (!fs.existsSync(row.tarball_path)) {
      res.status(404).json({ error: 'Tarball not found on disk' }); return;
    }

    queries.recordDownload.run(fullName, version);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(row.tarball_path)}"`);
    fs.createReadStream(row.tarball_path).pipe(res);
  });

  // PUT /extensions/:scope/:name/:version
  router.put('/:scope/:name/:version', async (req: Request, res: Response) => {
    const { scope, name, version } = req.params as { scope: string; name: string; version: string };
    const fullName = `@${scope}/${name}`;

    // Auth
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization required' }); return;
    }
    const publisher = await verifyPublisherToken(authHeader.slice(7));
    if (!publisher) { res.status(401).json({ error: 'Invalid token' }); return; }
    if (publisher.scope !== scope) {
      res.status(403).json({ error: `Token scope "${publisher.scope}" cannot publish to @${scope}` }); return;
    }

    // Check duplicate
    const existing = queries.getVersion.get(fullName, version);
    if (existing) { res.status(409).json({ error: 'Version already exists' }); return; }

    // Save tarball
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    await new Promise((resolve) => req.on('end', resolve));
    const body = Buffer.concat(chunks);

    const shasum = `sha256:${crypto.createHash('sha256').update(body).digest('hex')}`;
    const tarballPath = path.join(TARBALLS_DIR, `${scope}-${name}-${version}.tar.gz`);
    fs.writeFileSync(tarballPath, body);

    // Extract and validate manifest from tarball
    // For the reference impl, we trust the request body for manifest and validate it.
    // A production registry should extract kapsel.json from the tarball.
    let manifest: unknown;
    try {
      const manifestHeader = req.headers['x-kapsel-manifest'];
      if (typeof manifestHeader === 'string') {
        manifest = JSON.parse(manifestHeader);
      } else {
        // Minimal manifest from URL params for reference impl
        manifest = { kapsel: '0.2.0', name: fullName, version, type: 'skill', entry: './dist/index.js', capabilities: [], displayName: name, description: '', author: scope, license: 'MIT' };
      }
    } catch {
      fs.unlinkSync(tarballPath);
      res.status(422).json({ error: 'Invalid manifest JSON in X-Kapsel-Manifest header' }); return;
    }

    const validation = validateManifest(manifest);
    if (!validation.valid) {
      fs.unlinkSync(tarballPath);
      res.status(422).json({ error: 'Manifest validation failed', details: validation.errors }); return;
    }

    const m = manifest as Record<string, unknown>;

    // Persist
    db.transaction(() => {
      queries.upsertExtension.run(
        fullName,
        m['type'],
        m['displayName'],
        m['description'],
        m['author'],
        m['license'],
        version,
        JSON.stringify(m['keywords'] ?? [])
      );
      queries.insertVersion.run(fullName, version, JSON.stringify(manifest), tarballPath, shasum);
    })();

    res.status(201).json({
      name: fullName,
      version,
      publishedAt: Date.now(),
      tarballUrl: `${REGISTRY_URL}/extensions/${scope}/${name}/${version}.tar.gz`,
      shasum,
    });
  });

  return router;
}
