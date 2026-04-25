/**
 * Application-wide configuration and constants.
 * Centralizing these values makes the application easier to maintain and prevents
 * magic strings/numbers from being scattered across the codebase.
 */
export const APP_CONFIG = {
	// Target endpoints
	BASE_URL: 'https://www.myinstants.com',
	CATEGORIES_PATH: '/en/categories/',

	// Default values for CLI prompts
	DEFAULT_OUTPUT_DIR: './downloads',
	DEFAULT_MAX_PAGES: 5,

	// Status markers for the terminal output (Kept clean without emojis for broader OS support)
	MARKER_SKIPPED: 'SKIPPED',
	MARKER_SUCCESS: 'SUCCESS',
	MARKER_FAILED: 'FAILED',

	// Randomized Throttling Ranges (in milliseconds)
	// Provides a range to make the scraper behavior less predictable
	THROTTLE_FILE_MIN_MS: 2000,
	THROTTLE_FILE_MAX_MS: 4000,
	THROTTLE_PAGE_MIN_MS: 4000,
	THROTTLE_PAGE_MAX_MS: 8000,
} as const;
