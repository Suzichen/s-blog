import minimist from 'minimist';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface CliArgs {
  name?: string;
  description?: string;
  author?: string;
  pm?: 'npm' | 'yarn' | 'pnpm' | 'bun';
  'skip-install'?: boolean;
  help?: boolean;
  version?: boolean;
}

const HELP_TEXT = `
Usage: create-s-blog [options]

Options:
  --name <name>           Project name (default: my-blog)
  --description <desc>    Project description (default: A blog powered by S-blog)
  --author <author>       Author name (default: "")
  --pm <npm|yarn|pnpm|bun>    Package manager (default: npm)
  --skip-install          Skip dependency installation
  --help                  Show this help message
  --version               Show version number
`;

export function parseArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const args = minimist(argv, {
    string: ['name', 'description', 'author', 'pm'],
    boolean: ['skip-install', 'help', 'version'],
    alias: {
      h: 'help',
      v: 'version',
    },
  });

  return {
    name: args._[0] || args.name || undefined,
    description: args.description || undefined,
    author: args.author !== undefined ? args.author : undefined,
    pm: validatePm(args.pm),
    'skip-install': args['skip-install'] || false,
    help: args.help || false,
    version: args.version || false,
  };
}

function validatePm(pm: unknown): 'npm' | 'yarn' | 'pnpm' | 'bun' | undefined {
  if (pm === 'npm' || pm === 'yarn' || pm === 'pnpm' || pm === 'bun') return pm;
  if (pm) {
    console.warn(`Warning: Invalid package manager "${pm}", will use npm as default.`);
  }
  return undefined;
}

export function printHelp(): void {
  console.log(HELP_TEXT);
}

export function printVersion(): void {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));
    console.log(`create-s-blog v${pkg.version}`);
  } catch {
    console.log('create-s-blog v0.1.0');
  }
}
