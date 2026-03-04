import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { validateManifest } from '@kapsel/sdk';

export async function validateCommand(manifestPath?: string): Promise<void> {
  const resolvedPath = path.resolve(process.cwd(), manifestPath ?? 'kapsel.json');

  if (!(await fs.pathExists(resolvedPath))) {
    console.error(chalk.red(`Not found: ${resolvedPath}`));
    process.exit(1);
  }

  let raw: unknown;
  try {
    raw = await fs.readJSON(resolvedPath);
  } catch (err) {
    console.error(chalk.red(`Failed to parse JSON: ${resolvedPath}`));
    console.error(err);
    process.exit(1);
  }

  const result = validateManifest(raw);

  if (result.valid) {
    const manifest = raw as Record<string, unknown>;
    console.log(chalk.green('✓ Manifest valid'));
    console.log(`  ${chalk.bold(String(manifest['name']))} v${String(manifest['version'])} (${String(manifest['type'])})`);
  } else {
    console.error(chalk.red(`✗ Manifest invalid — ${result.errors.length} error(s):`));
    for (const err of result.errors) {
      console.error(chalk.yellow(`  ${err.field}: ${err.message}`));
    }
    process.exit(1);
  }
}
