import path from 'node:path';
import fs from 'fs-extra';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { TEMPLATES } from '../templates/index.js';
import type { ExtensionType } from '@kapsel/sdk';

interface InitOptions {
  type?: string;
  name?: string;
  install?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  console.log(chalk.bold('\nKapsel — New Extension\n'));

  const answers = await prompts(
    [
      {
        type: options.name ? null : 'text',
        name: 'name',
        message: 'Package name',
        initial: '@you/my-extension',
        validate: (v: string) =>
          /^@[a-z0-9-]+\/[a-z0-9-]+$/.test(v) ||
          'Must be in @scope/name format (lowercase, hyphens ok)',
      },
      {
        type: options.type ? null : 'select',
        name: 'type',
        message: 'Extension type',
        choices: [
          { title: 'skill   — tools + cron jobs + widgets', value: 'skill' },
          { title: 'agent   — autonomous, has planning loop', value: 'agent' },
          { title: 'channel — messaging adapter (Telegram, Slack...)', value: 'channel' },
          { title: 'tool    — single stateless function', value: 'tool' },
          { title: 'mcp-server — bridges an MCP server', value: 'mcp-server' },
        ],
      },
      {
        type: 'text',
        name: 'displayName',
        message: 'Display name',
        initial: (prev: unknown, values: Record<string, string>) => {
          const n = (options.name ?? values['name'] ?? '').split('/')[1] ?? '';
          return n.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        },
      },
      {
        type: 'text',
        name: 'description',
        message: 'Short description (max 280 chars)',
        validate: (v: string) => v.length <= 280 || 'Max 280 characters',
      },
      {
        type: 'text',
        name: 'author',
        message: 'Author / org name',
      },
    ],
    {
      onCancel: () => {
        console.log(chalk.yellow('\nCancelled.'));
        process.exit(0);
      },
    }
  );

  const name: string = options.name ?? answers['name'];
  const type = (options.type ?? answers['type']) as ExtensionType;
  const displayName: string = answers['displayName'];
  const description: string = answers['description'];
  const author: string = answers['author'];

  const scope = name.split('/')[0]!.slice(1);
  const pkgName = name.split('/')[1]!;
  const dir = path.resolve(process.cwd(), pkgName);

  if (await fs.pathExists(dir)) {
    console.log(chalk.red(`\nDirectory "${pkgName}" already exists.`));
    process.exit(1);
  }

  const spinner = ora('Scaffolding extension...').start();

  try {
    await fs.ensureDir(dir);
    await fs.ensureDir(path.join(dir, 'src'));

    const template = TEMPLATES[type];

    // kapsel.json
    await fs.writeJSON(
      path.join(dir, 'kapsel.json'),
      {
        kapsel: '0.2.0',
        name,
        version: '0.1.0',
        type,
        entry: './dist/index.js',
        capabilities: template.defaultCapabilities,
        displayName,
        description,
        author,
        license: 'MIT',
        keywords: [],
      },
      { spaces: 2 }
    );

    // package.json
    await fs.writeJSON(
      path.join(dir, 'package.json'),
      {
        name,
        version: '0.1.0',
        type: 'module',
        main: './dist/index.js',
        types: './dist/index.d.ts',
        scripts: {
          build: 'tsc -p tsconfig.json',
          typecheck: 'tsc -p tsconfig.json --noEmit',
          test: 'vitest run',
          prepare: 'pnpm build',
        },
        dependencies: { '@kapsel/sdk': `^0.2.0` },
        devDependencies: {
          '@kapsel/sdk-mock': '^0.2.0',
          typescript: '^5.4.0',
          vitest: '^1.6.0',
        },
        license: 'MIT',
      },
      { spaces: 2 }
    );

    // tsconfig.json
    await fs.writeJSON(
      path.join(dir, 'tsconfig.json'),
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'Node16',
          moduleResolution: 'Node16',
          lib: ['ES2022'],
          strict: true,
          declaration: true,
          declarationMap: true,
          sourceMap: true,
          outDir: './dist',
          rootDir: './src',
          esModuleInterop: true,
          skipLibCheck: true,
        },
        include: ['src'],
      },
      { spaces: 2 }
    );

    // src/index.ts from template
    await fs.writeFile(path.join(dir, 'src', 'index.ts'), template.entryTemplate({ name, displayName, description, author, scope, pkgName }));

    // README.md
    await fs.writeFile(
      path.join(dir, 'README.md'),
      `# ${displayName}\n\n${description}\n\n## Installation\n\nInstall from the Kapsel marketplace or run:\n\n\`\`\`bash\nkapsel install ${name}\n\`\`\`\n\n## Configuration\n\n_Document your configuration options here._\n\n## License\n\nMIT\n`
    );

    // .gitignore
    await fs.writeFile(path.join(dir, '.gitignore'), 'node_modules/\ndist/\n*.tsbuildinfo\n.env\n');

    spinner.succeed(`Extension scaffolded in ./${pkgName}/`);
  } catch (err) {
    spinner.fail('Scaffolding failed');
    throw err;
  }

  if (options.install !== false) {
    const installSpinner = ora('Installing dependencies...').start();
    const { execa } = await import('execa');
    try {
      await execa('pnpm', ['install'], { cwd: dir });
      installSpinner.succeed('Dependencies installed');
    } catch {
      installSpinner.warn('pnpm install failed — run it manually');
    }
  }

  console.log(chalk.green(`\nDone! Next steps:\n`));
  console.log(`  cd ${pkgName}`);
  console.log('  pnpm build');
  console.log('  pnpm test\n');
}
