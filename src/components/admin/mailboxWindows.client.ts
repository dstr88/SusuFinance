/**
 * mailboxWindows.client.ts — behavior for the /admin mail hero.
 *
 * Markup lives in MailboxWindows.astro, presentation in MailboxWindows.css. This
 * file touches the DOM only through classes and data attributes, with one
 * exception: the drag handle writes an explicit pixel height, because a resizable
 * panel's size IS state and there is no class that can express "371px".
 */

import { escapeHtml } from '@/lib/escapeHtml';

const DEFAULT_OPEN_PX = 320;
const MIN_PX = 90;
const heightKey = (mb: string) => `mh:h:${mb}`;

const q = <T extends Element>(root: ParentNode, sel: string) => root.querySelector<T>(sel);
const panels = () => Array.from(document.querySelectorAll<HTMLElement>('.mh'));

const fmt = (v: unknown) =>
	v ? new Date(String(v)).toLocaleString('en-US', {
		month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
	}) : '';

const fmtSize = (n: number) =>
	n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB`
	: n >= 1024 ? `${Math.round(n / 1024)} KB`
	: `${n} B`;

const mailboxOf = (el: Element) => el.closest<HTMLElement>('.mh')!.dataset.mailbox!;
const activeFolder = (panel: HTMLElement) =>
	q<HTMLElement>(panel, '.mh__rf--on')?.dataset.folder ?? '';

function setStatus(panel: HTMLElement, msg: string) {
	const el = q<HTMLElement>(panel, '.mh__status');
	if (el) el.textContent = msg;
}

// ── Open / close ──────────────────────────────────────────────────────────
function setOpen(panel: HTMLElement, open: boolean) {
	panel.classList.toggle('mh--open', open);
	q<HTMLElement>(panel, '.mh__bar')?.setAttribute('aria-expanded', String(open));
	if (!open) return;

	const body = q<HTMLElement>(panel, '.mh__body')!;
	const saved = Number(localStorage.getItem(heightKey(panel.dataset.mailbox!)) || 0);
	body.style.height = `${saved > MIN_PX ? saved : DEFAULT_OPEN_PX}px`;
	if (!body.dataset.loaded) load(panel);
}

document.addEventListener('click', (e) => {
	const bar = (e.target as Element).closest<HTMLElement>('.mh__bar');
	// Buttons inside the bar act on their own; only bare bar clicks toggle.
	if (!bar || (e.target as Element).closest('.mh__btn')) return;
	const panel = bar.closest<HTMLElement>('.mh')!;
	setOpen(panel, !panel.classList.contains('mh--open'));
});

document.addEventListener('keydown', (e) => {
	const bar = (e.target as Element).closest<HTMLElement>('.mh__bar');
	if (!bar || (e.key !== 'Enter' && e.key !== ' ')) return;
	e.preventDefault();
	const panel = bar.closest<HTMLElement>('.mh')!;
	setOpen(panel, !panel.classList.contains('mh--open'));
});

// ── Drag to resize ────────────────────────────────────────────────────────
// Pointer events rather than mouse events so a trackpad, touch screen and stylus
// all work from the same code path.
let drag: { panel: HTMLElement; startY: number; startH: number } | null = null;

document.addEventListener('pointerdown', (e) => {
	const grip = (e.target as Element).closest<HTMLElement>('.mh__grip');
	if (!grip) return;
	const panel = grip.closest<HTMLElement>('.mh')!;
	const body = q<HTMLElement>(panel, '.mh__body')!;
	drag = { panel, startY: e.clientY, startH: body.getBoundingClientRect().height };
	grip.setPointerCapture(e.pointerId);
	e.preventDefault();
});

document.addEventListener('pointermove', (e) => {
	if (!drag) return;
	const body = q<HTMLElement>(drag.panel, '.mh__body')!;
	const next = Math.max(MIN_PX, drag.startH + (e.clientY - drag.startY));
	body.style.height = `${next}px`;
});

document.addEventListener('pointerup', () => {
	if (!drag) return;
	const body = q<HTMLElement>(drag.panel, '.mh__body')!;
	localStorage.setItem(heightKey(drag.panel.dataset.mailbox!), String(Math.round(body.getBoundingClientRect().height)));
	drag = null;
});

// Keyboard resize, so the grip is not mouse-only.
document.addEventListener('keydown', (e) => {
	const grip = (e.target as Element).closest<HTMLElement>('.mh__grip');
	if (!grip || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
	e.preventDefault();
	const panel = grip.closest<HTMLElement>('.mh')!;
	const body = q<HTMLElement>(panel, '.mh__body')!;
	const next = Math.max(MIN_PX, body.getBoundingClientRect().height + (e.key === 'ArrowDown' ? 40 : -40));
	body.style.height = `${next}px`;
	localStorage.setItem(heightKey(panel.dataset.mailbox!), String(Math.round(next)));
});

// ── Tabs ──────────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
	const tab = (e.target as Element).closest<HTMLElement>('.mh__rf');
	if (!tab) return;
	const panel = tab.closest<HTMLElement>('.mh')!;
	panel.querySelectorAll('.mh__rf').forEach((t) => t.classList.remove('mh__rf--on'));
	tab.classList.add('mh__rf--on');
	load(panel);
});

// ── Load + render ─────────────────────────────────────────────────────────
async function load(panel: HTMLElement) {
	const list = q<HTMLElement>(panel, '.mh__list')!;
	const body = q<HTMLElement>(panel, '.mh__body')!;
	const mailbox = panel.dataset.mailbox!;
	const folder = activeFolder(panel);

	list.setAttribute('aria-busy', 'true');
	try {
		const res = await fetch(`/api/admin/mail?mailbox=${encodeURIComponent(mailbox)}&folder=${encodeURIComponent(folder)}`);
		const data = await res.json();
		if (!data.ok) throw new Error(data.error ?? 'Could not load');

		body.dataset.loaded = '1';
		list.innerHTML = folder === '__drafts__' ? renderDrafts(data) : renderMessages(data, mailbox);
		if (!list.innerHTML) list.innerHTML = '<p class="mh__empty">Nothing here.</p>';
	} catch (err) {
		list.innerHTML = `<p class="mh__empty">${escapeHtml(err instanceof Error ? err.message : 'Could not load')}</p>`;
	} finally {
		list.setAttribute('aria-busy', 'false');
	}
}

/** First line of the body, for the one-line preview next to the subject. */
const snippet = (t: string) => {
	const line = String(t ?? '').replace(/\s+/g, ' ').trim();
	return line.length > 90 ? `${line.slice(0, 90)}…` : line;
};

function renderMessages(data: any, mailbox: string): string {
	return (data.messages as any[]).map((m) => {
		const out = m.direction === 'out';
		const who = out
			? `To: ${escapeHtml(m.to_addrs)}`
			: escapeHtml(m.from_name || m.from_addr);
		const unread = !out && !m.read_at;
		const atts = (m.attachments ?? []) as any[];
		return `
			<div class="mhc${unread ? ' mhc--unread' : ''}${out ? ' mhc--out' : ''}" data-id="${escapeHtml(m.id)}" data-from="${escapeHtml(m.from_addr)}">
				<div class="mhc__row">
					<span class="mhc__who">${who}</span>
					<span class="mhc__subj">${escapeHtml(m.subject || '(no subject)')}${
						m.body_text ? ` <span class="mhc__snip">— ${escapeHtml(snippet(m.body_text))}</span>` : ''
					}</span>
					${atts.length ? '<span class="mhc__clip">📎</span>' : ''}
					<span class="mhc__when">${escapeHtml(fmt(m.sent_at))}</span>
				</div>
				<div class="mhc__open">
					<p class="mhc__body">${escapeHtml(m.body_text)}</p>
					${atts.length ? `<div class="mhc__atts">${atts.map((a) =>
						a.skipped
							? `<span class="mhc__att mhc__att--skip">📎 ${escapeHtml(a.filename)} (too large)</span>`
							: `<a class="mhc__att" href="/api/admin/mail/attachment?id=${encodeURIComponent(String(a.id))}" download>📎 ${escapeHtml(a.filename)} <span>${escapeHtml(fmtSize(Number(a.size_bytes ?? 0)))}</span></a>`
					).join('')}</div>` : ''}
					${m.send_error ? `<p class="mhc__err">Not sent: ${escapeHtml(m.send_error)}</p>` : ''}
					<div class="mhc__acts">
						${data.canSend && !out ? `<button class="mh__btn mhc__reply" type="button" data-id="${escapeHtml(m.id)}">Reply</button>` : ''}
						${unread ? `<button class="mh__btn mhc__read" type="button" data-id="${escapeHtml(m.id)}" data-mailbox="${escapeHtml(mailbox)}">Mark read</button>` : ''}
					</div>
				</div>
			</div>`;
	}).join('');
}

function renderDrafts(data: any): string {
	return (data.drafts as any[]).map((d) => `
		<div class="mhc mhc--out" data-draft="${escapeHtml(d.id)}">
			<div class="mhc__row">
				<span class="mhc__who">To: ${escapeHtml(d.to_addrs || '(no recipient)')}</span>
				<span class="mhc__subj">${escapeHtml(d.subject || '(no subject)')}${
					d.body_text ? ` <span class="mhc__snip">— ${escapeHtml(snippet(d.body_text))}</span>` : ''
				}</span>
				<span class="mhc__when">${escapeHtml(fmt(d.updated_at))}</span>
			</div>
			<div class="mhc__open">
				<p class="mhc__body">${escapeHtml(d.body_text)}</p>
				<div class="mhc__acts">
					<button class="mh__btn mhc__editdraft" type="button" data-draft="${escapeHtml(d.id)}">Edit</button>
					<button class="mh__btn mhc__deldraft" type="button" data-draft="${escapeHtml(d.id)}">Discard</button>
				</div>
			</div>
		</div>`).join('');
}

// Click a row to open it; clicking the open one again closes it. Buttons inside the
// expanded area act on their own and must not toggle the row shut underneath them.
document.addEventListener('click', (e) => {
	const row = (e.target as Element).closest<HTMLElement>('.mhc');
	if (!row || (e.target as Element).closest('.mh__btn, .mhc__att')) return;
	const wasOpen = row.classList.contains('mhc--sel');
	row.closest('.mh__list')?.querySelectorAll('.mhc--sel').forEach((r) => r.classList.remove('mhc--sel'));
	if (!wasOpen) row.classList.add('mhc--sel');
});

// ── Compose / reply / drafts ──────────────────────────────────────────────
function openForm(panel: HTMLElement, v: { to?: string; subject?: string; body?: string; replyToId?: string; draftId?: string } = {}) {
	const form = q<HTMLFormElement>(panel, '.mh__form')!;
	const dlg = q<HTMLDialogElement>(panel, '.mh__dlg')!;
	// showModal() rather than an .open class: focus trapping, an inert background
	// and Escape all come from the browser.
	if (!dlg.open) dlg.showModal();
	q<HTMLInputElement>(form, '.mh__to')!.value = v.to ?? '';
	q<HTMLInputElement>(form, '.mh__subj')!.value = v.subject ?? '';
	q<HTMLTextAreaElement>(form, '.mh__text')!.value = v.body ?? '';
	q<HTMLInputElement>(form, '.mh__replyto')!.value = v.replyToId ?? '';
	q<HTMLInputElement>(form, '.mh__draftid')!.value = v.draftId ?? '';
	q<HTMLElement>(form, '.mh__formstatus')!.textContent = '';
	q<HTMLTextAreaElement>(form, '.mh__text')!.focus();
}

document.addEventListener('click', (e) => {
	const t = e.target as Element;

	const compose = t.closest<HTMLElement>('.mh__compose');
	if (compose) {
		// No need to expand the panel first — the modal stands on its own, so New
		// works from a collapsed bar.
		openForm(compose.closest<HTMLElement>('.mh')!);
		return;
	}

	const cancel = t.closest<HTMLElement>('.mh__cancel');
	if (cancel) {
		cancel.closest<HTMLDialogElement>('.mh__dlg')?.close();
		return;
	}

	const reply = t.closest<HTMLElement>('.mhc__reply');
	if (reply) {
		const panel = reply.closest<HTMLElement>('.mh')!;
		const card = reply.closest<HTMLElement>('.mhc')!;
		const subjEl = q<HTMLElement>(card, '.mhc__subj');
		// Subject only — strip the preview snippet that shares the element.
		const snip = q<HTMLElement>(card, '.mhc__snip')?.textContent ?? '';
		const subj = (subjEl?.textContent ?? '').replace(snip, '').trim();
		openForm(panel, {
			// data-from carries the real address; the visible row shows a display name.
			to: card.dataset.from || '',
			subject: /^re:/i.test(subj) ? subj : `Re: ${subj}`,
			replyToId: reply.dataset.id,
		});
		return;
	}

	const edit = t.closest<HTMLElement>('.mhc__editdraft');
	if (edit) {
		const panel = edit.closest<HTMLElement>('.mh')!;
		const card = edit.closest<HTMLElement>('.mhc')!;
		openForm(panel, {
			to: (q<HTMLElement>(card, '.mhc__who')?.textContent ?? '').replace(/^To:\s*/, '').trim(),
			subject: (q<HTMLElement>(card, '.mhc__subj')?.textContent ?? '')
				.replace(q<HTMLElement>(card, '.mhc__snip')?.textContent ?? '', '').trim(),
			body: q<HTMLElement>(card, '.mhc__body')?.textContent ?? '',
			draftId: edit.dataset.draft,
		});
		return;
	}
});

// Mark read
document.addEventListener('click', async (e) => {
	const btn = (e.target as Element).closest<HTMLButtonElement>('.mhc__read');
	if (!btn?.dataset.id) return;
	btn.disabled = true;
	try {
		const res = await fetch('/api/admin/mail', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: btn.dataset.id, mailbox: btn.dataset.mailbox }),
		});
		if (!res.ok) throw new Error();
		btn.closest('.mhc')?.classList.remove('mhc--unread');
		btn.remove();
	} catch { btn.disabled = false; }
});

// Discard draft
document.addEventListener('click', async (e) => {
	const btn = (e.target as Element).closest<HTMLButtonElement>('.mhc__deldraft');
	if (!btn?.dataset.draft) return;
	const panel = btn.closest<HTMLElement>('.mh')!;
	btn.disabled = true;
	try {
		await fetch('/api/admin/mail/draft', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mailbox: mailboxOf(btn), draftId: btn.dataset.draft }),
		});
		load(panel);
	} catch { btn.disabled = false; }
});

// Save draft
document.addEventListener('click', async (e) => {
	const btn = (e.target as Element).closest<HTMLButtonElement>('.mh__savedraft');
	if (!btn) return;
	const panel = btn.closest<HTMLElement>('.mh')!;
	const form = btn.closest<HTMLFormElement>('.mh__form')!;
	const statusEl = q<HTMLElement>(form, '.mh__formstatus')!;
	btn.disabled = true;
	statusEl.textContent = 'Saving…';
	try {
		const res = await fetch('/api/admin/mail/draft', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				mailbox: panel.dataset.mailbox,
				draftId: q<HTMLInputElement>(form, '.mh__draftid')!.value || undefined,
				to: q<HTMLInputElement>(form, '.mh__to')!.value.trim(),
				cc: q<HTMLInputElement>(form, '.mh__cc')!.value.trim(),
				subject: q<HTMLInputElement>(form, '.mh__subj')!.value.trim(),
				body: q<HTMLTextAreaElement>(form, '.mh__text')!.value,
				replyToId: q<HTMLInputElement>(form, '.mh__replyto')!.value || undefined,
			}),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok || !data.ok) throw new Error(data.error ?? 'Save failed');
		q<HTMLInputElement>(form, '.mh__draftid')!.value = data.id;
		statusEl.textContent = 'Saved to Drafts.';
	} catch (err) {
		statusEl.textContent = err instanceof Error ? err.message : 'Save failed';
	} finally {
		btn.disabled = false;
	}
});

// Send
document.addEventListener('submit', async (e) => {
	const form = (e.target as Element).closest<HTMLFormElement>('.mh__form');
	if (!form) return;
	e.preventDefault();

	const panel = form.closest<HTMLElement>('.mh')!;
	const statusEl = q<HTMLElement>(form, '.mh__formstatus')!;
	const sendBtn = q<HTMLButtonElement>(form, '.mh__send')!;
	const draftId = q<HTMLInputElement>(form, '.mh__draftid')!.value;

	const payload = {
		mailbox: panel.dataset.mailbox,
		to: q<HTMLInputElement>(form, '.mh__to')!.value.trim(),
		cc: q<HTMLInputElement>(form, '.mh__cc')!.value.trim(),
		subject: q<HTMLInputElement>(form, '.mh__subj')!.value.trim(),
		body: q<HTMLTextAreaElement>(form, '.mh__text')!.value.trim(),
		replyToId: q<HTMLInputElement>(form, '.mh__replyto')!.value || undefined,
	};
	if (!payload.to) { statusEl.textContent = 'Add a recipient.'; return; }
	if (!payload.body) { statusEl.textContent = 'Message is empty.'; return; }

	sendBtn.disabled = true;
	statusEl.textContent = 'Sending…';
	try {
		const res = await fetch('/api/admin/mail', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

		// A sent draft is no longer a draft. Discard the server copy so it does not
		// linger in the Drafts folder alongside the message that actually went.
		if (draftId) {
			await fetch('/api/admin/mail/draft', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mailbox: panel.dataset.mailbox, draftId }),
			}).catch(() => {});
		}

		statusEl.textContent = 'Sent.';
		q<HTMLDialogElement>(panel, '.mh__dlg')?.close();
		load(panel);
	} catch (err) {
		statusEl.textContent = err instanceof Error ? err.message : 'Send failed.';
	} finally {
		sendBtn.disabled = false;
	}
});

// ── Check now ─────────────────────────────────────────────────────────────
document.addEventListener('click', async (e) => {
	const btn = (e.target as Element).closest<HTMLButtonElement>('.mh__check');
	if (!btn) return;
	const panel = btn.closest<HTMLElement>('.mh')!;
	btn.disabled = true;
	setStatus(panel, 'Checking…');
	try {
		const res = await fetch('/api/admin/mail/refresh', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mailbox: panel.dataset.mailbox }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

		// Surface a per-mailbox IMAP error rather than a blanket success — a wrong
		// password would otherwise look identical to an empty inbox.
		const failed = (data.results ?? []).find((r: any) => r.error);
		if (failed) setStatus(panel, failed.error);
		else if (!data.results?.length && data.throttled?.length) setStatus(panel, 'Just checked.');
		else setStatus(panel, data.inserted > 0 ? `${data.inserted} new` : 'Up to date');

		setOpen(panel, true);
		load(panel);
	} catch (err) {
		setStatus(panel, err instanceof Error ? err.message : 'Check failed');
	} finally {
		btn.disabled = false;
	}
});

// Restore any panel the operator left open.
// Open on first visit — a mail panel that shows nothing until it is discovered and
// clicked reads as broken. After that the operator's own choice is remembered.
for (const panel of panels()) {
	if (localStorage.getItem(`mh:open:${panel.dataset.mailbox}`) !== '0') setOpen(panel, true);
}
document.addEventListener('click', (e) => {
	const bar = (e.target as Element).closest<HTMLElement>('.mh__bar');
	if (!bar || (e.target as Element).closest('.mh__btn')) return;
	const panel = bar.closest<HTMLElement>('.mh')!;
	localStorage.setItem(`mh:open:${panel.dataset.mailbox}`, panel.classList.contains('mh--open') ? '1' : '0');
});
