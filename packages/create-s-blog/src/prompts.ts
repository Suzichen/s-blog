import prompts from 'prompts';
import type { CliArgs } from './args.js';

export interface UserInput {
  name: string;
  description: string;
  author: string;
  siteUrl: string;
  timezone?: string;
  packageManager: 'npm' | 'yarn' | 'pnpm';
  skipInstall: boolean;
}

export async function collectUserInput(args: CliArgs): Promise<UserInput> {
  const questions: prompts.PromptObject[] = [];

  if (!args.name) {
    questions.push({
      type: 'text',
      name: 'name',
      message: 'Project name:',
      initial: 'my-blog',
    });
  }

  if (!args.description) {
    questions.push({
      type: 'text',
      name: 'description',
      message: 'Project description:',
      initial: 'A blog powered by S-blog',
    });
  }

  if (args.author === undefined) {
    questions.push({
      type: 'text',
      name: 'author',
      message: 'Author name:',
      initial: '',
    });
  }

  // siteUrl for SEO (sitemap, rss, og tags)
  questions.push({
    type: 'text',
    name: 'siteUrl',
    message: 'Site URL (for SEO, leave empty to skip):',
    initial: '',
  });

  const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (systemTimezone) {
    questions.push({
      type: 'confirm',
      name: 'useSystemTimezone',
      message: `Detected system timezone: ${systemTimezone}. Use this for your blog?`,
      initial: true,
    });

    questions.push({
      type: prev => prev ? null : 'text',
      name: 'customTimezone',
      message: 'Enter IANA timezone identifier (leave empty to skip):',
      initial: '',
    });
  } else {
    questions.push({
      type: 'text',
      name: 'customTimezone',
      message: 'Enter IANA timezone identifier (leave empty to skip):',
      initial: '',
    });
  }

  if (!args.pm) {
    questions.push({
      type: 'select',
      name: 'packageManager',
      message: 'Package manager:',
      choices: [
        { title: 'npm', value: 'npm' },
        { title: 'yarn', value: 'yarn' },
        { title: 'pnpm', value: 'pnpm' },
      ],
      initial: 0,
    });
  }

  let cancelled = false;
  const response = await prompts(questions, {
    onCancel: () => {
      cancelled = true;
    },
  });

  if (cancelled) {
    throw new Error('USER_CANCELLED');
  }

  let timezone: string | undefined = undefined;
  if (response.useSystemTimezone) {
    timezone = systemTimezone;
  } else if (response.customTimezone && response.customTimezone.trim() !== '') {
    timezone = response.customTimezone.trim();
  }

  return {
    name: args.name || response.name || 'my-blog',
    description: args.description || response.description || 'A blog powered by S-blog',
    author: args.author !== undefined ? args.author : (response.author || ''),
    siteUrl: response.siteUrl || '',
    timezone: timezone,
    packageManager: args.pm || response.packageManager || 'npm',
    skipInstall: args['skip-install'] || false,
  };
}
