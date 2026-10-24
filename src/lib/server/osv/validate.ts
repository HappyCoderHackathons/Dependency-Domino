import type { VulnerabilityQuery } from '#lib/types.js';

export const MAX_PACKAGES = 2000;
export const MAX_BODY_BYTES = 1024 * 1024;

// Regular expressions for validating package names and versions.
const NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export type QueryValidation = { ok: true; packages: VulnerabilityQuery['packages'] } | { ok: false; message: string };

export function validateQuery(text: string): QueryValidation {
	if (text.length > MAX_BODY_BYTES) {
		return { ok: false, message: 'Request body is too large' };
	}

	let body;
	try {
		body = JSON.parse(text);
	} catch (error) {
		return { ok: false, message: 'Invalid JSON in request body' };
	}

	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request body must be an object' };
	}

	if (!('packages' in body)) {
		return { ok: false, message: 'Request body must contain a `packages` array' };
	}

	if (!Array.isArray(body.packages)) {
		return { ok: false, message: '`packages` must be an array' };
	}

	if (body.packages.length > MAX_PACKAGES) {
		return { ok: false, message: `Too many packages in request (max ${MAX_PACKAGES})` };
	}

	const validatedPackages = [];
	for (const pkg of body.packages) {
		if (typeof pkg !== 'object' || pkg === null) {
			return { ok: false, message: 'Each package must be an object' };
		}
		if (typeof pkg.name !== 'string') {
			return { ok: false, message: 'Each package must have a string `name` property' };
		}
		if (pkg.name.length > 214) {
			return { ok: false, message: 'Each package name must be 214 characters or less' };
		}
		if (!NAME.test(pkg.name)) {
			return { ok: false, message: 'Each package name is invalid' };
		}
		if (typeof pkg.version !== 'string') {
			return { ok: false, message: 'Each package must have a string `version` property' };
		}
		if (pkg.version.length > 64) {
			return { ok: false, message: 'Each package version must be 64 characters or less' };
		}
        if (!VERSION.test(pkg.version)) {
            return { ok: false, message: 'Each package version is invalid' };
        }
        validatedPackages.push({ name: pkg.name, version: pkg.version });
    }

    return { ok: true, packages: validatedPackages };
}