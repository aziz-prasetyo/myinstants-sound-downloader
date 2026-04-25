import * as v from 'valibot';

/**
 * Validates the output directory path.
 * Ensures the user provides a non-empty string for the path.
 */
export const OutputDirSchema = v.pipe(
	v.string(),
	v.minLength(1, 'Output directory path cannot be empty.')
);

/**
 * Validates the maximum pages input.
 * Ensures the input is a numeric string, transforms it to a Number,
 * and guarantees it is at least 1 to prevent infinite zero-loops.
 */
export const MaxPagesSchema = v.pipe(
	v.string(),
	v.regex(/^\d+$/, 'Must be a valid positive integer.'),
	v.transform(Number),
	v.minValue(1, 'You must scrape at least 1 page.')
);
