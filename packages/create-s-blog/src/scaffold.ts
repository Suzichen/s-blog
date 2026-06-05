import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserInput } from './prompts.js';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { scaffoldBlog, cleanupBlog } = require('../index.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, '../template');

/**
 * Copy template files to the target directory and generate customized files.
 * Delegates to the Rust scaffold engine via NAPI.
 */
export async function copyTemplate(targetDir: string, input: UserInput): Promise<void> {
  try {
    scaffoldBlog({
      targetDir,
      templateDir: TEMPLATE_DIR,
      name: input.name,
      description: input.description,
      author: input.author,
      siteUrl: input.siteUrl || undefined,
      timezone: input.timezone || undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Target directory already exists')) {
      throw new Error(`DIRECTORY_EXISTS:${path.basename(targetDir)}`);
    }
    // Attempt cleanup on any other error
    cleanup(targetDir);
    throw new Error('COPY_FAILED');
  }
}

/**
 * Remove the target directory and all its contents.
 */
export function cleanup(targetDir: string): void {
  cleanupBlog(targetDir);
}
