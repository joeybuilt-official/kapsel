/**
 * kapsel init
 * Scaffold a new Kapsel extension from a template.
 */

import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { ExtensionType } from '@kapsel/sdk';

const TEMPLATES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../templates'
);

export function initCommand(): Command {
  return new Command('init')
    .description('Scaffold a new Kapsel extension')
    .argument('[directory]', 'Target directory (defaults to current)')
    .action(async (directory?: string) => {
      console.log(chalk.bold('\nKapsel Extension Scaffolder'));
      console.log(chalk.dim('Creates a new extension from a template.\n'));

      const answers = await prompts(
        [
          {
            type: 'text',
            name: 'scope',
            message: 'Publisher scope (without @)',
            initial: 'my-org',
            validate: (v: string) => /^[a-z0-9-]+$/.test(v) || 'Lowercase alphanumeric and hyphens only',
          },
          {
            type: 'text',
            name: 'name',
            message: 'Extension name',
            initial: 'my-extension',
            validate: (v: string) => /^[a-z0-9-]+$/.test(v) || 'Lowercase alphanumeric and hyphens only',
          },
          {
            type: 'select',
            name: 'type',
            message: 'Extension type',
            choices: [
              { title: 'Skill   — tools + cron jobs + widgets', value: 'skill' },
              { title: 'Agent   — autonomous planning loop',    value: 'agent' },
              { title: 'Channel — messaging adapter',           value: 'channel' },
              { title: 'Tool    — single stateless function',   value: 'tool' },
            ],
          },
          {
            type: 'text',
            name: 'description',
            message: 'Short description',
            validate: (v: string) => v.length <= 280 || 'Max 280 characters',
          },
          {
            type: 'text',
            name: 'author',
            message: 'Author name',
          },
        ],
        {
          onCancel: () => {
            console.log(chalk.yellow('\nCancelled.'));
            process.exit(0);
          },
        }
      );

      const { scope, name, type, description, author } = answers as {
        scope: string;
        name: string;
        type: ExtensionType;
        description: string;
        author: string;
      };

      const targetDir = directory ?? name;
      const fullName = `@${scope}/${name}`;

      const spinner = ora(`Creating ${chalk.cyan(fullName)} in ${chalk.cyan(targetDir)}`).start();

      try {
        const templateDir = path.join(TEMPLATES_DIR, type);
        const exists = await fs.pathExists(templateDir);

        if (!exists) {
          spinner.fail(`Template for type "${type}" not found at ${templateDir}`);
          process.exit(1);
        }

        await fs.copy(templateDir, targetDir, { overwrite: false });

        // Write kapsel.json
        const manifest = {
          kapsel: '0.2.0',
          name: fullName,
          version: '0.1.0',
          type,
          entry: './dist/index.js',
          capabilities: getDefaultCapabilities(type),
          displayName: toDisplayName(name),
          description,
          author,
          license: 'MIT',
        };

        await fs.writeJson(path.join(targetDir, 'kapsel.json'), manifest, { spaces: 2 });

        // Update package.json name field
        const pkgPath = path.join(targetDir, 'package.json');
        if (await fs.pathExists(pkgPath)) {
          const pkg = await fs.readJson(pkgPath) as Record<string, unknown>;
          pkg['name'] = fullName;
          pkg['description'] = description;
          await fs.writeJson(pkgPath, pkg, { spaces: 2 });
        }

        spinner.succeed(`Created ${chalk.cyan(fullName)}`);

        console.log(chalk.dim('\nNext steps:'));
        console.log(`  cd ${targetDir}`);
        console.log('  pnpm install');
        console.log('  pnpm build');
        console.log(`  kapsel validate`);
      } catch (err) {
        spinner.fail('Failed to scaffold extension');
        console.error(err);
        process.exit(1);
      }
    });
}

function getDefaultCapabilities(type: ExtensionType): string[] {
  switch (type) {
    case 'skill': return ['memory:read', 'memory:write', 'channel:send', 'schedule:register', 'storage:read', 'storage:write'];
    case 'agent': return ['memory:read', 'memory:write', 'tasks:create', 'tasks:read', 'events:subscribe', 'channel:send'];
    case 'channel': return ['channel:receive', 'storage:read', 'storage:write'];
    case 'tool': return ['storage:read', 'storage:write'];
    case 'mcp-server': return [];
  }
}

function toDisplayName(kebab: string): string {
  return kebab.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
