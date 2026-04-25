import { mkdir } from 'fs/promises';
import { join } from 'path';
import pc from 'picocolors';
import { log, spinner } from '@clack/prompts';
import { sanitizeFilename } from './utils';
import { APP_CONFIG } from './constants';
import type { AppConfig } from './cli';
import readline from 'readline';
import { sleep } from 'bun';

/**
 * Executes a dynamic delay with a real-time countdown displayed in the terminal.
 * @param min - Minimum delay in ms
 * @param max - Maximum delay in ms
 * @param label - Context label (e.g., "next file" or "next page")
 */
async function executeDynamicThrottle(min: number, max: number, label: string) {
	const delay = Math.floor(Math.random() * (max - min + 1) + min);
	const startTime = Date.now();

	// Move cursor to a new line,
	// so it doesn't overwrite the Category Progress bar
	process.stdout.write('\n');

	while (Date.now() - startTime < delay) {
		const remaining = ((delay - (Date.now() - startTime)) / 1000).toFixed(1);

		// Update the same line with the countdown information
		readline.cursorTo(process.stdout, 0);
		readline.clearLine(process.stdout, 0);
		process.stdout.write(pc.dim(`   Next ${label} in ${remaining}s...`));

		await sleep(100); // Update frequency
	}

	// Clear the countdown line before proceeding
	readline.cursorTo(process.stdout, 0);
	readline.clearLine(process.stdout, 0);

	// Move the cursor back UP to the Category Progress line,
	// so the next iteration's dual-render cycle stays perfectly aligned.
	readline.moveCursor(process.stdout, 0, -1);
}

/**
 * Generates a visual, block-based progress bar without structural brackets.
 * Example output: ████████░░ 80%
 */
function drawProgressBar(percentage: number, length = 20, showPercentage = true): string {
	const filled = Math.round((length * percentage) / 100);
	const empty = Math.max(0, length - filled);
	const bar = pc.green('█'.repeat(filled)) + pc.gray('░'.repeat(empty));
	return showPercentage ? `${bar} ${percentage}%` : `${bar}`;
}

/**
 * Mutates the terminal's active rendering context to update two lines concurrently.
 * This prevents log spam and creates a native-feeling UI experience.
 */
function renderDualLines(fileLine: string, categoryLine: string) {
	readline.moveCursor(process.stdout, 0, -1);
	readline.cursorTo(process.stdout, 0);
	readline.clearLine(process.stdout, 0);
	process.stdout.write(fileLine + '\n');
	readline.cursorTo(process.stdout, 0);
	readline.clearLine(process.stdout, 0);
	process.stdout.write(categoryLine);
}

/**
 * Executes the core downloading engine based on the user-defined configuration.
 * Features idempotency (skips existing files) and synthetic progress animations.
 */
export async function runDownloader(config: AppConfig) {
	let totalFilesDownloaded = 0;
	let totalSkippedFiles = 0;
	let totalFailedFiles = 0;

	const startTime = Date.now();
	const downloadedCategoryNames: string[] = [];

	log.info(
		pc.cyan(
			`Initializing download sequence for ${config.categoriesToDownload.length} category(ies)...`
		)
	);

	for (const category of config.categoriesToDownload) {
		const safeCategoryName = sanitizeFilename(category.name);
		const categoryDir = join(config.baseOutputDir, safeCategoryName);

		// Recursively ensure the target directory exists before writing
		await mkdir(categoryDir, { recursive: true });
		log.step(`Processing Category: ${pc.blue(pc.bold(category.name))} -> ${categoryDir}`);

		let categoryFileCount = 0;

		for (let page = 1; page <= config.maxPages; page++) {
			const pageUrl = `${category.url}?page=${page}`;
			const scanSpinner = spinner();
			scanSpinner.start(`Scanning page ${page} for audio assets...`);

			try {
				const response = await fetch(pageUrl);
				if (!response.ok) {
					scanSpinner.stop(
						pc.yellow(`Page ${page} unreachable or depleted. Skipping to next target.`)
					);
					break;
				}

				const html = await response.text();
				const mp3Regex = /\/media\/sounds\/[^"']+\.mp3/g;

				// Ensure uniqueness to avoid redundant network calls within the same page
				const matches = [...new Set(html.match(mp3Regex))];

				if (matches.length === 0) {
					scanSpinner.stop(
						pc.gray(`No assets found on page ${page}. Category processing concluded.`)
					);
					break;
				}

				scanSpinner.stop(`Page ${page}: Discovered ${matches.length} assets.`);

				const totalInPage = matches.length;

				for (let i = 0; i < totalInPage; i++) {
					const match = matches[i];
					if (!match) continue;

					const fullAudioUrl = `${APP_CONFIG.BASE_URL}${match}`;
					const rawFilename = match.split('/').pop() || `sound-${Date.now()}.mp3`;
					const cleanFilename = decodeURIComponent(rawFilename);
					const targetFilePath = join(categoryDir, cleanFilename);

					// Optimization: Idempotency check. Utilizing Bun's native API for maximum disk read speed.
					const fileExists = await Bun.file(targetFilePath).exists();

					// Allocate space for the dual-line renderer
					process.stdout.write('\n');

					if (fileExists) {
						// Bypass network request and animation overhead entirely
						const existingFileSize = (Bun.file(targetFilePath).size / 1024).toFixed(1);
						const skippedLine = `   ${pc.yellow(APP_CONFIG.MARKER_SKIPPED)} [${i + 1}/${totalInPage}]: ${pc.yellow(cleanFilename)} ${pc.gray(`(${existingFileSize}KB)`)}`;
						const finalCatPercentage = ((i + 1) / totalInPage) * 100;
						const finalCategoryLine = `   ${pc.magenta('Page Progress:')} [${i + 1}/${totalInPage}] ${drawProgressBar(finalCatPercentage, 30, false)}`;

						renderDualLines(skippedLine, finalCategoryLine);

						categoryFileCount++;
						totalSkippedFiles++;
						continue;
					}

					let isSuccess = false;
					let finalBytes = 0;

					// Perform the actual network fetch
					try {
						const dlResponse = await fetch(fullAudioUrl);
						if (dlResponse.ok) {
							const totalBytes = parseInt(
								dlResponse.headers.get('content-length') || '0'
							);
							const reader = dlResponse.body?.getReader();

							if (reader) {
								const chunks: Uint8Array[] = [];
								let receivedBytes = 0;

								// REAL-TIME STREAMING LOOP
								// We read chunks of data as they arrive from the network
								while (true) {
									const { done, value } = await reader.read();
									if (done) break;

									chunks.push(value);
									receivedBytes += value.length;

									// Update UI with real-time percentage and byte counts
									const percentage =
										totalBytes > 0
											? Math.round((receivedBytes / totalBytes) * 100)
											: 0;
									const loadedKb = (receivedBytes / 1024).toFixed(1);
									const totalKb = (totalBytes / 1024).toFixed(1);

									const fileLine = `   ${pc.cyan('Downloading')} ${pc.cyan(cleanFilename)} ${drawProgressBar(percentage, 20, true)} (${loadedKb}KB / ${totalKb}KB)`;
									const categoryLine = `   ${pc.magenta('Page Progress:')} [${i}/${totalInPage}] ${drawProgressBar((i / totalInPage) * 100, 30, false)}`;

									renderDualLines(fileLine, categoryLine);
								}

								// Finalize file data assembly
								const fileData = new Uint8Array(receivedBytes);
								let offset = 0;
								for (const chunk of chunks) {
									fileData.set(chunk, offset);
									offset += chunk.length;
								}

								await Bun.write(targetFilePath, fileData);
								isSuccess = true;
								finalBytes = receivedBytes;
							}
						}
					} catch (_e) {
						isSuccess = false;
					}

					// Render final state for the current file
					const finalSizeKb = (finalBytes / 1024).toFixed(1);
					let finalFileLine = '';

					if (isSuccess) {
						finalFileLine = `   ${pc.green(APP_CONFIG.MARKER_SUCCESS)} [${i + 1}/${totalInPage}]: ${pc.green(cleanFilename)} ${pc.gray(`(${finalSizeKb}KB)`)}`;
						categoryFileCount++;
						totalFilesDownloaded++;
					} else {
						finalFileLine = `   ${pc.red(APP_CONFIG.MARKER_FAILED)} [${i + 1}/${totalInPage}]: ${pc.red(cleanFilename)}`;
						totalFailedFiles++;
					}

					renderDualLines(
						finalFileLine,
						`   ${pc.magenta('Page Progress:')} [${i + 1}/${totalInPage}] ${drawProgressBar(((i + 1) / totalInPage) * 100, 30, false)}`
					);

					// DYNAMIC FILE THROTTLE
					if (i + 1 < totalInPage) {
						await executeDynamicThrottle(
							APP_CONFIG.THROTTLE_FILE_MIN_MS,
							APP_CONFIG.THROTTLE_FILE_MAX_MS,
							'file'
						);
					}
				}

				// Advance cursor past the rendered block to prevent overwriting
				process.stdout.write('\n');
			} catch (_e) {
				scanSpinner.stop(
					pc.red(`Critical error encountered while processing page ${page}.`)
				);
				break;
			}

			if (page < config.maxPages) {
				await executeDynamicThrottle(
					APP_CONFIG.THROTTLE_PAGE_MIN_MS,
					APP_CONFIG.THROTTLE_PAGE_MAX_MS,
					'page'
				);
			}
		}

		log.success(
			`Category ${category.name} successfully resolved. (${categoryFileCount} files managed)`
		);
		if (categoryFileCount > 0) downloadedCategoryNames.push(category.name);
	}

	const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

	// Consolidated final summary
	log.info(pc.bgGreen(pc.black(' DOWNLOAD SEQUENCE COMPLETE ')));

	const summary = [
		`Files Downloaded : ${pc.bold(totalFilesDownloaded)}`,
		`Skipped Existing : ${pc.yellow(totalSkippedFiles)}`,
		`Categories Saved : ${pc.bold(downloadedCategoryNames.length)} ${pc.gray(`(${downloadedCategoryNames.join(', ')})`)}`,
		`Execution Time   : ${durationSeconds} seconds`,
		`Storage Location : ${config.baseOutputDir}`,
	];

	if (totalFailedFiles > 0) summary.unshift(`Failed Downloads : ${pc.red(totalFailedFiles)}`);
	log.message(summary.join('\n'));
}
