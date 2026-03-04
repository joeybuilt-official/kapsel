/**
 * kapsel validate
 * Validate kapsel.json without building.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { validateManifest } from '@kapsel/sdk';

export function validateCommand(): Command {
  return new Command('validate')
    .description('Validate kapsel.json in the current or specified directory')
    .argument('[directory]', 'Directory containing kapsel.json', '.')
    .action(async (directory: string) => {
      const manifestPath = path.join(directory, 'kapsel.json');

      if (!(await fs.pathExists(manifestPath))) {
        console.error(chalk.red(`Error: kapsel.json not found at ${manifestPath}`));
        process.exit(1);
      }

      let raw: unknown;
      try {
        raw = await fs.readJson(manifestPath);
      } catch {
        console.error(chalk.red('Error: kapsel.json is not valid JSON'));
        process.exit(1);
      }

      const result = validateManifest(raw);

      if (result.valid) {
        const m = raw as Record<string, unknown>;
        console.log(chalk.green('\n✓ Manifest valid'));
        console.log(chalk.dim(`  Name:    ${m['name']}@${m['version']}`));
        console.log(chalk.dim(`  Type:    ${m['type']}` ));
        console.log(chalk.dim(`  Kapsel:  ${m['kapsel']}`));
        const caps = m['capabilities'] as string[];
        console.log(chalk.dim(`  Caps:    ${caps.join(', ')}\n`));
      } else {
        console.error(chalk.red(`\n✗ Manifest invalid (${result.errors.length} error${result.errors.length > 1 ? 's' : ''})\n`));
        for (const err of result.errors) {
          console.error(chalk.red(`  • ${err.field}: ${err.message}`));
        }
        console.log();
        process.exit(1);
      }
    });
}
