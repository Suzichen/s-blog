import type { UserInput } from './prompts.js';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { scaffoldBlog, cleanupBlog } = require('../index.cjs');

/**
 * Copy template files to the target directory and generate customized files.
 * Delegates to the Rust scaffold engine via NAPI.
 */
export async function copyTemplate(targetDir: string, input: UserInput): Promise<void> {
  try {
    scaffoldBlog({
      targetDir,
      name: input.name,
      description: input.description,
      author: input.author,
      siteUrl: input.siteUrl || undefined,
      timezone: input.timezone || undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Target directory already exists')) {
      throw new Error(`DIRECTORY_EXISTS:${targetDir.split(/[/\\]/).pop()}`);
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
