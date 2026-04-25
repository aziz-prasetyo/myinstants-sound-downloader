import { text, select, multiselect, spinner, isCancel, cancel, log, intro } from '@clack/prompts';
import pc from 'picocolors';
import * as v from 'valibot';
import { fetchValidCategories, type Category } from './scraper';
import { APP_CONFIG } from './constants';
import { OutputDirSchema, MaxPagesSchema } from './schemas';
import { resolveOutputPath } from './utils';

export interface AppConfig {
	baseOutputDir: string;
	categoriesToDownload: Category[];
	maxPages: number;
}

/**
 * Orchestrates the interactive Command Line Interface.
 * * @returns The structured configuration object based on user input, or null if aborted.
 * * @description
 * Guides the user through a series of prompts to configure the scraping engine.
 * Implements strict validation via Valibot while preserving the native fallback
 * behaviors of the Clack UI library.
 */
export async function runCli(): Promise<AppConfig | null> {
	console.clear();

	// Pure ASCII Art rendering to establish brand identity without triggering Clack's visual brackets prematurely
	const asciiTitle = `
  __  __       _           _              _
 |  \\/  |     (_)         | |            | |
 | \\  / |_   _ _ _ __  ___| |_ __ _ _ __ | |_ ___
 | |\\/| | | | | | '_ \\/ __| __/ _\` | '_ \\| __/ __|
 | |  | | |_| | | | | \\__ \\ || (_| | | | | |_\\__ \\
 |_|  |_|\\__, |_|_| |_|___/\\__\\__,_|_| |_|\\__|___/
          __/ |      SOUND DOWNLOADER
         |___/
  `;

	console.log(pc.cyan(pc.bold(asciiTitle)));

	// Opens the visual scope for the prompts
	intro(pc.bgCyan(pc.black(' Configuration Setup ')));

	const baseOutputDir = await text({
		message: 'Where do you want to save the downloaded audio files?',
		placeholder: APP_CONFIG.DEFAULT_OUTPUT_DIR,
		defaultValue: APP_CONFIG.DEFAULT_OUTPUT_DIR,
		validate: (value) => {
			// Guard clause: Permits empty input to allow Clack's defaultValue to take over safely
			if (!value) return;
			const result = v.safeParse(OutputDirSchema, value);
			if (!result.success) return result.issues[0].message;
		},
	});

	if (isCancel(baseOutputDir)) {
		cancel('Operation cancelled by user.');
		return null;
	}

	const s = spinner();
	s.start('Fetching the latest category list from the server...');

	const validCategories = await fetchValidCategories();

	if (validCategories.length === 0) {
		s.stop(pc.red('Failed to fetch valid categories.'));
		cancel('Make sure you have an active internet connection.');
		return null;
	}

	s.stop(pc.green(`Successfully fetched ${validCategories.length} available categories.`));

	const mode = await select({
		message: 'Which categories would you like to download?',
		options: [
			{ value: 'specific', label: 'Select specific categories manually' },
			{ value: 'all', label: 'Download all categories (Process may take significant time)' },
		],
	});

	if (isCancel(mode)) {
		cancel('Operation cancelled by user.');
		return null;
	}

	let categoriesToDownload: Category[];

	if (mode === 'all') {
		categoriesToDownload = validCategories;
	} else {
		const selected = await multiselect({
			message: 'Select categories (SPACE to select, ENTER to confirm):',
			options: validCategories.map((c) => ({ value: c, label: c.name })),
			required: true,
		});

		if (isCancel(selected)) {
			cancel('Operation cancelled by user.');
			return null;
		}
		categoriesToDownload = selected as Category[];
	}

	const maxPagesStr = await text({
		message: 'What is the maximum number of pages to download per category?',
		placeholder: APP_CONFIG.DEFAULT_MAX_PAGES.toString(),
		defaultValue: APP_CONFIG.DEFAULT_MAX_PAGES.toString(),
		validate: (value) => {
			if (!value) return;
			const result = v.safeParse(MaxPagesSchema, value);
			if (!result.success) return result.issues[0].message;
		},
	});

	if (isCancel(maxPagesStr)) {
		cancel('Operation cancelled by user.');
		return null;
	}

	log.success(pc.green('Configuration complete. Preparing download engine...'));

	// Normalize the path before passing it to the engine
	const resolvedOutputDir = resolveOutputPath(baseOutputDir as string);

	return {
		baseOutputDir: resolvedOutputDir,
		categoriesToDownload,
		maxPages: Number(maxPagesStr),
	};
}
