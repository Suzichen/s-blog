#!/usr/bin/env node
'use strict';

const path = require('path');
const pkg = require('../package.json');

const args = process.argv.slice(2);

function printHelp() {
  console.log(`s-blog v${pkg.version}

Usage: s-blog <command> [options]

Commands:
  build   Build the blog for production deployment
  serve   Start a development preview server
  sync    Sync media files to S3-compatible storage

Options:
  --version  Show version number
  --help     Show this help message

Run "s-blog <command> --help" for command-specific options.`);
}

function printBuildHelp() {
  console.log(`Usage: s-blog build [options]

Build the blog for production deployment.

Options:
  --output <dir>  Output directory (default: dist)`);
}

function printServeHelp() {
  console.log(`Usage: s-blog serve [options]

Start a development preview server.

Options:
  --port <number>  Port to listen on (default: 3000)`);
}

function printSyncHelp() {
  console.log(`Usage: s-blog sync --media [options]

Sync local album media to S3-compatible storage.

Options:
  --media     Sync album media files (required)
  --dry-run   Preview files to upload without uploading`);
}

function getFlag(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(flag) {
  return args.includes(flag);
}

function loadEngine() {
  try {
    return require(path.resolve(__dirname, '..', 'index.js'));
  } catch (e1) {
    try {
      return require('@s-blog/engine');
    } catch (e2) {
      process.stderr.write(`Error: Failed to load @s-blog/engine: ${e2.message}\n`);
      process.exit(1);
    }
  }
}

// Global flags
if (hasFlag('--version') || hasFlag('-v')) {
  console.log(pkg.version);
  process.exit(0);
}

if (args.length === 0 || (args.length === 1 && hasFlag('--help'))) {
  printHelp();
  process.exit(0);
}

const command = args[0];

if (command === 'build') {
  if (hasFlag('--help')) {
    printBuildHelp();
    process.exit(0);
  }

  const engine = loadEngine();
  const opts = {};
  const output = getFlag('--output');
  if (output) opts.outputDir = output;

  try {
    const resultJson = engine.buildCommand(JSON.stringify(opts));
    const result = JSON.parse(resultJson);
    console.log(`\nBuild completed in ${result.durationMs}ms`);
    console.log(`  Shell files: ${result.shellFilesCount}`);
    console.log(`  Posts: ${result.postsCount}`);
    console.log(`  Albums: ${result.albumsCount}`);
    console.log(`  SEO pages: ${result.seoPagesCount}`);
    console.log(`  Static files: ${result.staticFilesCount}`);
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    process.exit(1);
  }
} else if (command === 'serve') {
  if (hasFlag('--help')) {
    printServeHelp();
    process.exit(0);
  }

  const engine = loadEngine();
  const opts = {};
  const port = getFlag('--port');
  if (port !== undefined) {
    const p = Number(port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      process.stderr.write(`Error: Invalid port "${port}". Must be an integer between 1 and 65535.\n`);
      process.exit(1);
    }
    opts.port = p;
  }

  try {
    engine.serveCommand(JSON.stringify(opts));
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    process.exit(1);
  }
} else if (command === 'sync') {
  if (hasFlag('--help')) {
    printSyncHelp();
    process.exit(0);
  }

  if (!hasFlag('--media')) {
    process.stderr.write(`Error: Missing --media flag. Run "s-blog sync --help" for usage.\n`);
    process.exit(1);
  }

  const engine = loadEngine();
  const opts = {};
  if (hasFlag('--dry-run')) opts.dryRun = true;

  try {
    const resultJson = engine.syncMediaCommand(JSON.stringify(opts));
    const result = JSON.parse(resultJson);
    console.log(`\nSync completed in ${result.durationMs}ms`);
    console.log(`  Uploaded: ${result.uploaded}`);
    console.log(`  Skipped: ${result.skipped}`);
    if (result.failed.length > 0) {
      console.log(`  Failed: ${result.failed.length}`);
      result.failed.forEach(f => console.log(`    - ${f}`));
    }
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    process.exit(1);
  }
} else {
  process.stderr.write(`Error: Unknown command "${command}". Run "s-blog --help" for usage.\n`);
  process.exit(1);
}
