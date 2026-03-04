/**
 * kapsel publish
 * Pack and publish an extension to a Kapsel registry.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as tar from 'tar';
import { validateManifest } from '@kapsel/sdk';

const DEFAULT_REGISTRY = 'https://registry.kapsel.sh';

export function publishCommand(): Command {
  return new Command('publish')
    .description('Publish an extension to a Kapsel registry')
    .argument('[directory]', 'Directory to publish', '.')
    .option('--registry <url>', 'Registry URL', DEFAULT_REGISTRY)
    .option('--token <token>', 'Publisher token (or set KAPSEL_TOKEN env var)')
    .option('--dry-run', 'Pack without publishing')
    .action(async (directory: string, options: { registry: string; token?: string; dryRun?: boolean }) => {
      const manifestPath = path.join(directory, 'kapsel.json');

      if (!(await fs.pathExists(manifestPath))) {
        console.error(chalk.red(`kapsel.json not found in ${directory}`));
        process.exit(1);
      }

      // Validate
      const validateSpinner = ora('Validating manifest').start();
      const raw = await fs.readJson(manifestPath);
      const result = validateManifest(raw);
      if (!result.valid) {
        validateSpinner.fail('Manifest invalid');
        for (const e of result.errors) console.error(chalk.red(`  • ${e.field}: ${e.message}`));
        process.exit(1);
      }
      validateSpinner.succeed('Manifest valid');

      const manifest = raw as Record<string, unknown>;
      const pkgName = (manifest['name'] as string).replace('@', '').replace('/', '-');
      const version = manifest['version'] as string;
      const tarballName = `${pkgName}-${version}.tar.gz`;
      const tarballPath = path.join(directory, tarballName);

      // Check entry exists
      const entryRelative = (manifest['entry'] as string).replace(/^\.?\//,  '');
      if (!(await fs.pathExists(path.join(directory, entryRelative)))) {
        console.error(chalk.red('Entry point not found. Run `kapsel build` first.'));
        process.exit(1);
      }

      // Pack
      const packSpinner = ora(`Packing ${tarballName}`).start();
      const filesToPack = ['kapsel.json', 'dist', 'README.md', 'LICENSE', 'CHANGELOG.md']
        .filter((f) => fs.pathExistsSync(path.join(directory, f)));

      await tar.create(
        { gzip: true, file: tarballPath, cwd: directory },
        filesToPack
      );

      const stat = await fs.stat(tarballPath);
      packSpinner.succeed(`Packed ${tarballName} (${(stat.size / 1024).toFixed(1)} KB)`);

      if (options.dryRun) {
        console.log(chalk.yellow('\nDry run — not publishing.'));
        console.log(chalk.dim(`  Tarball: ${tarballPath}\n`));
        return;
      }

      // Publish
      const token = options.token ?? process.env['KAPSEL_TOKEN'];
      if (!token) {
        console.error(chalk.red('\nNo token provided. Use --token or set KAPSEL_TOKEN env var.'));
        process.exit(1);
      }

      const publishSpinner = ora(`Publishing to ${options.registry}`).start();

      try {
        const nameEncoded = (manifest['name'] as string)
          .replace('@', '')
          .split('/')
          .map(encodeURIComponent)
          .join('/');

        const url = `${options.registry}/extensions/${nameEncoded}/${version}`;
        const body = await fs.readFile(tarballPath);

        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
          },
          body,
        });

        if (res.status === 201) {
          const json = await res.json() as Record<string, unknown>;
          publishSpinner.succeed(`Published ${manifest['name']}@${version}`);
          console.log(chalk.dim(`  Registry: ${options.registry}`));
          console.log(chalk.dim(`  URL:      ${json['tarballUrl'] ?? url}\n`));
        } else if (res.status === 409) {
          publishSpinner.fail(`Version ${version} already exists`);
          process.exit(1);
        } else {
          const text = await res.text();
          publishSpinner.fail(`Publish failed: ${res.status}`);
          console.error(chalk.red(text));
          process.exit(1);
        }
      } catch (err) {
        publishSpinner.fail('Network error during publish');
        console.error(err);
        process.exit(1);
      } finally {
        await fs.remove(tarballPath);
      }
    });
}
