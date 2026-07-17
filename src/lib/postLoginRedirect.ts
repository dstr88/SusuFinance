function normalizeNextPath(nextValue: FormDataEntryValue | string | null | undefined) {
	if (typeof nextValue !== 'string' || nextValue.length === 0) {
		return null;
	}

	// Reject `//host` and `/\host` — both are treated as protocol-relative
	// external URLs by browsers (Chrome normalizes `\` to `/`).
	if (nextValue.startsWith('/') && !nextValue.startsWith('//') && !nextValue.startsWith('/\\')) {
		// Never treat API endpoints as post-login destinations. Falls back to the lobby,
		// not Almstins' onboarding page — there is no setup step here, and that page now
		// just bounces back to the lobby anyway.
		if (nextValue.startsWith('/api/')) {
			return '/dashboard/lobby';
		}
		return nextValue;
	}

	return null;
}

export function getPostLoginRedirect(nextValue: FormDataEntryValue | string | null | undefined) {
	const normalized = normalizeNextPath(nextValue);
	if (normalized) {
		return normalized;
	}

	// Everyone lands in the lobby and chooses their own door — admin, or the
	// member's way in. Almstins sent people to /dashboard, which role-checked and
	// decided FOR them (/admin or /dashboard/vault). That is the opposite shape:
	// there, one kind of user had one destination. Here the lobby is the fork, and
	// picking your door is the point.
	//
	// A `next` path still wins (above), so a deep link someone was sent to survives
	// the login round-trip.
	return '/dashboard/lobby';
}
