import prompts from 'prompts';
import type { CliArgs } from './args.js';

export interface UserInput {
  name: string;
  description: string;
  author: string;
  siteUrl: string;
  timezone?: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  skipInstall: boolean;
}

export async function collectUserInput(args: CliArgs): Promise<UserInput> {
  const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (args.yes) {
    return {
      name: args.name || 'my-blog',
      description: args.description || 'A blog powered by spage',
      author: args.author !== undefined ? args.author : '',
      siteUrl: args.siteUrl || '',
      timezone: args.timezone || systemTimezone || undefined,
      packageManager: args.pm || 'npm',
      skipInstall: args['skip-install'] || false,
    };
  }

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
      initial: 'A blog powered by spage',
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

  if (args.siteUrl === undefined) {
    // siteUrl for SEO (sitemap, rss, og tags)
    questions.push({
      type: 'text',
      name: 'siteUrl',
      message: 'Site URL (for SEO, leave empty to skip):',
      initial: '',
    });
  }

  if (args.timezone === undefined) {
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
        { title: 'bun', value: 'bun' },
      ],
      initial: 0,
    });
  }

  let cancelled = false;
  // If there are no questions to ask, we can skip prompts
  let response: any = {};
  if (questions.length > 0) {
    response = await prompts(questions, {
      onCancel: () => {
        cancelled = true;
      },
    });

    if (cancelled) {
      throw new Error('USER_CANCELLED');
    }
  }

  let timezone: string | undefined = args.timezone;
  if (args.timezone === undefined) {
    if (response.useSystemTimezone) {
      timezone = systemTimezone;
    } else if (response.customTimezone && response.customTimezone.trim() !== '') {
      timezone = response.customTimezone.trim();
    }
  }

  return {
    name: args.name || response.name || 'my-blog',
    description: args.description || response.description || 'A blog powered by spage',
    author: args.author !== undefined ? args.author : (response.author || ''),
    siteUrl: args.siteUrl !== undefined ? args.siteUrl : (response.siteUrl || ''),
    timezone: timezone,
    packageManager: args.pm || response.packageManager || 'npm',
    skipInstall: args['skip-install'] || false,
  };
}
