/**
 * notepads.client.ts — load and autosave the two pads.
 *
 * Autosave rather than a Save button: a scratch pad whose contents can be lost by
 * navigating away is a scratch pad nobody trusts with anything worth writing down.
 */

const SAVE_DEBOUNCE_MS = 800;

const pads = () => Array.from(document.querySelectorAll<HTMLElement>('.np__pad'));

function setStatus(pad: HTMLElement, text: string): void {
	const el = pad.querySelector<HTMLElement>('.np__status');
	if (el) el.textContent = text;
}

async function load(): Promise<void> {
	try {
		const res = await fetch('/api/admin/notes');
		const data = await res.json();
		if (!data.ok) return;

		for (const pad of pads()) {
			const scope = pad.dataset.scope as 'admin' | 'personal';
			const area = pad.querySelector<HTMLTextAreaElement>('.np__text');
			if (!area) continue;
			// .value, not innerHTML — a shared pad is written by another person, and this
			// is the admin origin.
			area.value = data[scope]?.body ?? '';
		}
	} catch {
		for (const pad of pads()) setStatus(pad, 'Could not load');
	}
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function queueSave(pad: HTMLElement): void {
	const scope = pad.dataset.scope!;
	clearTimeout(timers.get(scope));
	setStatus(pad, 'Saving…');

	timers.set(scope, setTimeout(async () => {
		const area = pad.querySelector<HTMLTextAreaElement>('.np__text');
		if (!area) return;
		try {
			const res = await fetch('/api/admin/notes', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ scope, body: area.value }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data.ok) throw new Error(data.error ?? 'Save failed');
			setStatus(pad, 'Saved');
			// Clear the confirmation rather than leaving it up: a permanent "Saved" says
			// nothing about the edit made after it.
			setTimeout(() => setStatus(pad, ''), 1500);
		} catch (err) {
			setStatus(pad, err instanceof Error ? err.message : 'Save failed');
		}
	}, SAVE_DEBOUNCE_MS));
}

document.addEventListener('input', (e) => {
	const area = (e.target as Element).closest<HTMLTextAreaElement>('.np__text');
	if (!area) return;
	queueSave(area.closest<HTMLElement>('.np__pad')!);
});

// Blur saves immediately — the debounce is for typing, not for leaving.
document.addEventListener('blur', (e) => {
	const area = (e.target as Element)?.closest?.<HTMLTextAreaElement>('.np__text');
	if (area) queueSave(area.closest<HTMLElement>('.np__pad')!);
}, true);

void load();
