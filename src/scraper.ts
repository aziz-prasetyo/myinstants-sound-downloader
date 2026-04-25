import { APP_CONFIG } from './constants';
import { sanitizeFilename } from './utils';

export interface Category {
	name: string;
	url: string;
	slug: string;
}

const CATEGORIES_PAGE_URL = `${APP_CONFIG.BASE_URL}${APP_CONFIG.CATEGORIES_PATH}`;

/**
 * Fetches and parses the valid categories directly from the Myinstants web page.
 * * @returns An array of uniquely parsed categories sorted alphabetically.
 * * @description
 * By dynamically scraping the categories rather than hardcoding them, the application
 * remains resilient to future updates on the target website. It acts as the absolute
 * Source of Truth for the application state.
 */
export async function fetchValidCategories(): Promise<Category[]> {
	try {
		const response = await fetch(CATEGORIES_PAGE_URL);
		if (!response.ok) {
			throw new Error(`HTTP Error: ${response.status}`);
		}

		const html = await response.text();

		// Matches anchor tags specific to the categories section
		const categoryRegex = /<a[^>]*href="(\/en\/categories\/[^"/]+\/)"[^>]*>([^<]+)<\/a>/gi;

		// Using a Map to guarantee uniqueness based on the URL path
		const categoriesMap = new Map<string, Category>();
		let match;

		while ((match = categoryRegex.exec(html)) !== null) {
			if (!match[1] || !match[2]) continue;

			const path = match[1];
			const name = match[2].trim().replace(/&amp;/g, '&');

			// Prevent the root categories path from being falsely registered as a distinct category
			if (path === APP_CONFIG.CATEGORIES_PATH) continue;

			if (!categoriesMap.has(path)) {
				categoriesMap.set(path, {
					name,
					url: `${APP_CONFIG.BASE_URL}${path}id/`,
					slug: sanitizeFilename(name).toLowerCase(),
				});
			}
		}

		// Convert the Map to an array and sort alphabetically for a better user experience in the CLI
		return Array.from(categoriesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
	} catch (_e) {
		return [];
	}
}
