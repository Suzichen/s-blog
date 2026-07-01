#!/usr/bin/env node

import path from 'node:path';
import { parseArgs, printHelp, printVersion } from './args.js';
import { collectUserInput } from './prompts.js';
import { copyTemplate, cleanup } from './scaffold.js';
import { installDependencies } from './install.js';
import {
  printBanner,
  printSuccess,
  printErrorDirectoryExists,
  printErrorCopyFailed,
  printErrorInstallFailed,
  printCancelled,
} from './messages.js';

let targetDir: string | null = null;
let shouldCleanup = false;

// Register cleanup handler for SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  if (shouldCleanup && targetDir) {
    cleanup(targetDir);
    printCancelled();
  }
  process.exit(1);
});

async function main(): Promise<void> {
  // Parse command-line arguments
  const args = parseArgs();

  if (args.help) {
    printHelp();
    return;
  }

  if (args.version) {
    printVersion();
    return;
  }

  printBanner();

  // Collect user input (interactive prompts for missing fields)
  let userInput;
  try {
    userInput = await collectUserInput(args);
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_CANCELLED') {
      console.log('\n  Operation cancelled.');
      return;
    }
    throw err;
  }

  // Set target directory
  targetDir = path.resolve(process.cwd(), userInput.name);
  shouldCleanup = true;

  // Copy template files
  try {
    await copyTemplate(targetDir, userInput);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.startsWith('DIRECTORY_EXISTS:')) {
        const dirName = err.message.split(':')[1];
        printErrorDirectoryExists(dirName);
        return;
      }
      if (err.message === 'COPY_FAILED') {
        printErrorCopyFailed();
        return;
      }
    }
    throw err;
  }

  // Install dependencies
  if (!userInput.skipInstall) {
    try {
      await installDependencies(targetDir, userInput.packageManager);
    } catch {
      printErrorInstallFailed(userInput.name, userInput.packageManager);
      // Don't exit — project files were created successfully
    }
  }

  shouldCleanup = false;
  printSuccess(userInput);
}

main().catch((err) => {
  console.error(err);
  if (shouldCleanup && targetDir) {
    cleanup(targetDir);
  }
  process.exit(1);
});
