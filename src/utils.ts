import { homedir } from 'os';
import { resolve, join } from 'path';

/**
 * Sanitizes a string to ensure it can be safely used as a directory or file name.
 * * @param name - The raw string to sanitize.
 * @returns A safe string compatible with Windows, macOS, and Linux file systems.
 * * @description
 * Strips out illegal characters (e.g., /, \, :, *, ?, ", <, >, |) and replaces
 * them with underscores to prevent file system write errors.
 */
export const sanitizeFilename = (name: string): string =>
	name.replace(/[^a-z0-9.\- ]/gi, '_').trim();

/**
 * Resolves and normalizes directory paths, specifically handling the tilde (~)
 * character which represents the user's home directory.
 * @param rawPath - The raw path string inputted by the user.
 * @returns The absolute, normalized path safely interpreted for the host OS.
 * @description
 * Interactive CLI inputs bypass shell expansion, meaning "~" is read as a literal
 * string rather than the home directory. This utility intercepts the tilde and
 * maps it safely using Node's OS module, preventing the creation of literal "~" folders.
 */
export const resolveOutputPath = (rawPath: string): string => {
	// Check if the path starts with tilde for Unix (/) or Windows (\)
	if (rawPath === '~' || rawPath.startsWith('~/') || rawPath.startsWith('~\\')) {
		return join(homedir(), rawPath.slice(1));
	}

	// Converts relative paths (like ./downloads) into safe absolute paths
	return resolve(rawPath);
};
