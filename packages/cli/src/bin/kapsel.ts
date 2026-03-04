#!/usr/bin/env node
/**
 * @kapsel/cli
 * Scaffold, build, validate, and publish Kapsel extensions.
 */

import { Command } from 'commander';
import { initCommand } from '../commands/init.js';
import { buildCommand } from '../commands/build.js';
import { validateCommand } from '../commands/validate.js';
import { publishCommand } from '../commands/publish.js';

const program = new Command();

program
  .name('kapsel')
  .description('CLI for Kapsel extension development')
  .version('0.2.0');

program
  .command('init')
  .description('Scaffold a new Kapsel extension')
  .option('-t, --type <type>', 'Extension type (agent|skill|channel|tool|mcp-server)')
  .option('-n, --name <name>', 'Extension name (@scope/name)')
  .option('--no-install', 'Skip pnpm install after scaffolding')
  .action(initCommand);

program
  .command('build')
  .description('Build the extension (compile TypeScript + validate manifest)')
  .option('--no-validate', 'Skip manifest validation')
  .action(buildCommand);

program
  .command('validate')
  .description('Validate kapsel.json without building')
  .argument('[path]', 'Path to kapsel.json (defaults to ./kapsel.json)')
  .action(validateCommand);

program
  .command('publish')
  .description('Publish extension to a registry')
  .option('-r, --registry <url>', 'Registry URL', 'https://registry.kapsel.sh')
  .option('--tag <tag>', 'Publish tag', 'latest')
  .option('--dry-run', 'Pack and validate without publishing')
  .action(publishCommand);

program.parse();
