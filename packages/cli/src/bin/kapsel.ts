#!/usr/bin/env node
/**
 * @kapsel/cli entry point
 */

import { Command } from 'commander';
import { initCommand } from '../commands/init.js';
import { buildCommand } from '../commands/build.js';
import { validateCommand } from '../commands/validate.js';
import { publishCommand } from '../commands/publish.js';

const program = new Command();

program
  .name('kapsel')
  .description('CLI for building and publishing Kapsel extensions')
  .version('0.2.0');

program.addCommand(initCommand());
program.addCommand(buildCommand());
program.addCommand(validateCommand());
program.addCommand(publishCommand());

program.parse();
