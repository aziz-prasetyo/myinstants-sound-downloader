import pc from 'picocolors';
import readline from 'readline';
import { runCli } from './cli';
import { runDownloader } from './downloader';
import { confirm, isCancel } from '@clack/prompts';

/**
 * Pauses the terminal before exiting.
 * Prevents the OS from immediately closing the window when the standalone executable finishes.
 */
async function pauseAndExit(exitCode: number = 0) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	await new Promise((resolve) => {
		rl.question(pc.dim('\nPress ENTER to close this window...'), resolve);
	});

	rl.close();
	process.exit(exitCode);
}

/**
 * Bootstraps the application.
 * Manages the high-level control flow from CLI configuration collection
 * to executing the core scraping engine, including global error handling.
 */
async function main() {
	try {
		let keepRunning = true;

		while (keepRunning) {
			const config = await runCli();

			// Contextual exit: Occurs if the user safely aborts via prompt commands (e.g., Ctrl+C in Clack)
			if (!config) {
				break;
			}

			await runDownloader(config);

			// Interactive prompt to allow users to continue without reopening the app
			const shouldRestart = await confirm({
				message: 'Do you want to download more sounds or categories?',
				initialValue: false, // Defaults to "No" for safe exiting
			});

			if (isCancel(shouldRestart) || !shouldRestart) {
				keepRunning = false;
			}
		}

		console.log(pc.green('\nThank you for using Myinstants Sound Downloader!'));
		await pauseAndExit(0);
	} catch (error) {
		// Failsafe for unhandled exceptions
		// The pause ensures the user can actually read the error stack trace before the terminal closes
		console.error(
			pc.red('\nA fatal error occurred during execution. Stack trace provided below:\n')
		);
		console.error(error);
		await pauseAndExit(1);
	}
}

/**
 * Global signal handler for OS-level interrupts (e.g., Ctrl+C forcefully pressed).
 * Ensures the process does not terminate abruptly without user context.
 */
process.on('SIGINT', () => {
	console.log(
		pc.yellow('\n\nExecution forcefully interrupted by user. Terminating processes...')
	);
	process.exit(0);
});

main();
