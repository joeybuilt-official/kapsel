/**
 * kapsel build
 * Compile TypeScript and validate manifest.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs-extra';
import * as path from 'path';
import { spawn } from 'child_process';
import { validateManifest } from '@kapsel/sdk';

export function buildCommand(): Command {
  return new Command('build')
    .description('Compile extension and validate manifest')
    .argument('[directory]', 'Directory to build', '.')
    .option('--no-validate', 'Skip manifest validation')
    .action(async (directory: string, options: { validate: boolean }) => {
      const manifestPath = path.join(directory, 'kapsel.json');

      // Step 1: Validate manifest
      if (options.validate !== false) {
        const validateSpinner = ora('Validating kapsel.json').start();
        if (!(await fs.pathExists(manifestPath))) {
          validateSpinner.fail(`kapsel.json not found in ${directory}`);
          process.exit(1);
        }
        const raw = await fs.readJson(manifestPath);
        const result = validateManifest(raw);
        if (!result.valid) {
          validateSpinner.fail('Manifest validation failed');
          for (const err of result.errors) {
            console.error(chalk.red(`  • ${err.field}: ${err.message}`));
          }
          process.exit(1);
        }
        validateSpinner.succeed('Manifest valid');
      }

      // Step 2: Run tsc
      const buildSpinner = ora('Compiling TypeScript').start();
      const tscPath = path.join(directory, 'node_modules', '.bin', 'tsc');
      const hasTsc = await fs.pathExists(tscPath);
      const tscBin = hasTsc ? tscPath : 'tsc';

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(tscBin, ['-p', path.join(directory, 'tsconfig.json')], {
          cwd: directory,
          stdio: 'pipe',
        });
        let stderr = '';
        proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
        proc.stdout?.on('data', (d: Buffer) => { stderr += d.toString(); });
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(stderr));
        });
      }).then(() => {
        buildSpinner.succeed('Compiled successfully');
      }).catch((err: Error) => {
        buildSpinner.fail('TypeScript compilation failed');
        console.error(chalk.red(err.message));
        process.exit(1);
      });

      // Step 3: Verify entry point exists
      const manifest = await fs.readJson(manifestPath) as Record<string, unknown>;
      const entryRelative = (manifest['entry'] as string).replace(/^\.?\//,  '');
      const entryAbs = path.join(directory, entryRelative);
      if (!(await fs.pathExists(entryAbs))) {
        console.error(chalk.red(`\nEntry point not found after build: ${entryAbs}`));
        process.exit(1);
      }

      console.log(chalk.green(`\n✓ Build complete`));
      console.log(chalk.dim(`  Entry: ${entryAbs}\n`));
    });
}
