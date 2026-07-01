import { spawn } from 'node:child_process';

/**
 * Install dependencies in the target directory using the specified package manager.
 */
export function installDependencies(
  targetDir: string,
  pm: 'npm' | 'yarn' | 'pnpm' | 'bun',
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = pm;
    const args = ['install'];

    const child = spawn(command, args, {
      cwd: targetDir,
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`INSTALL_FAILED:${pm}`));
      }
    });

    child.on('error', () => {
      reject(new Error(`INSTALL_FAILED:${pm}`));
    });
  });
}
