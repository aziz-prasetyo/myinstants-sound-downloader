import pc from 'picocolors';
import { runCli } from './cli';
import { runDownloader } from './downloader';

/**
 * Bootstraps the application.
 * Manages the high-level control flow from CLI configuration collection
 * to executing the core scraping engine, including global error handling.
 */
async function main() {
	try {
		const config = await runCli();

		// Contextual exit: Occurs if the user safely aborts via prompt commands (e.g., Ctrl+C in Clack)
		if (!config) {
			process.exit(0);
		}

		await runDownloader(config);
	} catch (error) {
		// Failsafe for unhandled exceptions outside the operational boundaries
		console.error(
			pc.red('\nA fatal error occurred during execution. Stack trace provided below:\n')
		);
		console.error(error);
		process.exit(1);
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
