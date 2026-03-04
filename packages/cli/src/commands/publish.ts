import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import tar from 'tar';
import os from 'node:os';
import { validateManifest } from '@kapsel/sdk';

interface PublishOptions {
  registry: string;
  tag: string;
  dryRun?: boolean;
}

export async function publishCommand(options: PublishOptions): Promise<void> {
  const cwd = process.cwd();
  const manifestPath = path.join(cwd, 'kapsel.json');

  if (!(await fs.pathExists(manifestPath))) {
    console.error(chalk.red('kapsel.json not found'));
    process.exit(1);
  }

  const manifest = (await fs.readJSON(manifestPath)) as Record<string, unknown>;
  const validation = validateManifest(manifest);
  if (!validation.valid) {
    console.error(chalk.red('Manifest invalid — run `kapsel validate` for details'));
    process.exit(1);
  }

  // Check dist exists
  if (!(await fs.pathExists(path.join(cwd, 'dist')))) {
    console.error(chalk.red('dist/ not found — run `kapsel build` first'));
    process.exit(1);
  }

  const name = String(manifest['name']);
  const version = String(manifest['version']);
  const [scopePart, pkgPart] = name.split('/');
  const scope = (scopePart ?? '').slice(1);
  const pkg = pkgPart ?? '';
  const tarballName = `${scope}-${pkg}-${version}.tar.gz`;
  const tarballPath = path.join(os.tmpdir(), tarballName);

  const packSpinner = ora('Packing extension...').start();
  try {
    await tar.create(
      {
        gzip: true,
        file: tarballPath,
        cwd,
        filter: (p) => {
          const rel = p.replace(/^\.\//u, '');
          return (
            !rel.startsWith('node_modules') &&
            !rel.startsWith('.git') &&
            !rel.endsWith('.env') &&
            rel !== tarballName
          );
        },
      },
      ['.']
    );
    packSpinner.succeed(`Packed: ${tarballName}`);
  } catch (err) {
    packSpinner.fail('Pack failed');
    throw err;
  }

  if (options.dryRun) {
    console.log(chalk.yellow(`\nDry run — not publishing. Tarball at: ${tarballPath}`));
    return;
  }

  // Get publisher token
  const token = process.env['KAPSEL_TOKEN'];
  if (!token) {
    console.error(chalk.red('\nKAPSEL_TOKEN env var required. Get a token at kapsel.sh/tokens'));
    process.exit(1);
  }

  const publishSpinner = ora(`Publishing to ${options.registry}...`).start();
  try {
    const tarball = await fs.readFile(tarballPath);
    const url = `${options.registry}/extensions/${scope}/${pkg}/${version}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'X-Kapsel-Tag': options.tag,
      },
      body: tarball,
    });

    if (!response.ok) {
      const body = await response.text();
      publishSpinner.fail(`Publish failed: ${response.status}`);
      console.error(body);
      process.exit(1);
    }

    const result = (await response.json()) as Record<string, unknown>;
    publishSpinner.succeed(`Published ${name}@${version}`);
    console.log(chalk.green(`\n✓ ${name}@${version} published to ${options.registry}`));
    if (result['tarballUrl']) {
      console.log(`  Tarball: ${String(result['tarballUrl'])}`);
    }
  } catch (err) {
    publishSpinner.fail('Publish failed');
    throw err;
  } finally {
    await fs.remove(tarballPath).catch(() => {});
  }
}
