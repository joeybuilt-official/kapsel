import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { validateManifest } from '@kapsel/sdk';

interface BuildOptions {
  validate?: boolean;
}

export async function buildCommand(options: BuildOptions): Promise<void> {
  const cwd = process.cwd();
  const manifestPath = path.join(cwd, 'kapsel.json');

  // Validate manifest first (unless --no-validate)
  if (options.validate !== false) {
    const manifestSpinner = ora('Validating manifest...').start();
    if (!(await fs.pathExists(manifestPath))) {
      manifestSpinner.fail('kapsel.json not found');
      process.exit(1);
    }
    const raw = await fs.readJSON(manifestPath);
    const result = validateManifest(raw);
    if (!result.valid) {
      manifestSpinner.fail('Manifest invalid');
      for (const err of result.errors) {
        console.error(chalk.yellow(`  ${err.field}: ${err.message}`));
      }
      process.exit(1);
    }
    manifestSpinner.succeed('Manifest valid');
  }

  // Compile TypeScript
  const buildSpinner = ora('Compiling TypeScript...').start();
  try {
    execSync('pnpm exec tsc -p tsconfig.json', { cwd, stdio: 'pipe' });
    buildSpinner.succeed('Build complete');
  } catch (err: unknown) {
    buildSpinner.fail('TypeScript compilation failed');
    if (err && typeof err === 'object' && 'stdout' in err) {
      console.error(String((err as { stdout: unknown }).stdout));
    }
    process.exit(1);
  }

  // Read manifest and report
  const manifest = (await fs.readJSON(manifestPath)) as Record<string, unknown>;
  console.log(chalk.green(`\n✓ Built ${String(manifest['name'])} v${String(manifest['version'])} (${String(manifest['type'])})`));
}
