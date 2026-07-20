/**
 * CircleBoard — signup task bar over a grid of circle tins.
 *
 * Self-contained and importable: it fetches its own data and needs no props beyond an
 * optional heading, so any page can drop it in.
 *
 *   import CircleBoard from '@/components/circles/CircleBoard';
 *   <CircleBoard client:load />
 *
 * ── What it does ────────────────────────────────────────────────────────────
 * People who have signed up but belong to no circle sit in the bar. Drag one onto a
 * tin to place them. Select several and "Generate group" makes a new forming circle
 * out of them.
 *
 * ── The rule the drop obeys ─────────────────────────────────────────────────
 * A FORMING circle accepts the drop directly — that is the organizer seeding a circle
 * that has not started, per §5a. An ACTIVE circle does not: it opens an admission vote
 * and the group decides. The operator can propose, never admit. That distinction is
 * the blackball rule, and it is enforced server-side in seatMember() as well as shown
 * here, because a UI affordance is not a boundary.
 */

import { useCallback, useEffect, useState } from 'react';
import './CircleBoard.css';

interface Signup {
	memberId: string;
	displayName: string | null;
	email: string | null;
	createdAt: string;
	pendingVote: boolean;
}

interface BoardCircle {
	id: string;
	name: string;
	type: 'circle' | 'target_group';
	status: 'forming' | 'active' | 'completed' | 'abandoned';
	cadence: string;
	expectedAmount: string;
	currency: string;
	memberCount: number;
}

/** Her chosen name, or a shortened id — which is a choice, not a missing name. */
function label(s: Signup): string {
	return s.displayName || `${s.memberId.slice(0, 8)}…`;
}

export default function CircleBoard({ heading = 'Signups' }: { heading?: string }) {
	const [signups, setSignups] = useState<Signup[]>([]);
	const [circles, setCircles] = useState<BoardCircle[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [dragging, setDragging] = useState<string | null>(null);
	const [over, setOver] = useState<string | null>(null);
	const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const [formOpen, setFormOpen] = useState(false);
	const [form, setForm] = useState({ name: '', expectedAmount: '', cadence: 'monthly' });

	const load = useCallback(async () => {
		try {
			const res = await fetch('/api/admin/circles/board');
			const data = await res.json();
			if (!data.ok) throw new Error(data.error ?? 'Could not load');
			setSignups(data.signups);
			setCircles(data.circles);
		} catch (err) {
			setNote({ kind: 'err', text: err instanceof Error ? err.message : 'Could not load' });
		}
	}, []);

	useEffect(() => { void load(); }, [load]);

	const post = useCallback(async (body: unknown) => {
		setBusy(true);
		try {
			const res = await fetch('/api/admin/circles/board', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			const data = await res.json();
			if (!data.ok) throw new Error(data.error ?? 'Failed');
			return data;
		} finally {
			setBusy(false);
		}
	}, []);

	const drop = useCallback(async (contractId: string) => {
		if (!dragging) return;
		try {
			const data = await post({ action: 'assign', memberId: dragging, contractId });
			setNote(
				data.outcome === 'vote_opened'
					? { kind: 'ok', text: 'That circle is active, so an admission vote is now open. The group decides.' }
					: { kind: 'ok', text: 'Placed in the circle.' },
			);
			await load();
		} catch (err) {
			setNote({ kind: 'err', text: err instanceof Error ? err.message : 'Could not place them' });
		} finally {
			setDragging(null);
			setOver(null);
		}
	}, [dragging, post, load]);

	const generate = useCallback(async () => {
		try {
			// No selection is fine — an empty forming tin is a perfectly good thing to
			// make and then drag people into.
			await post({
				action: 'group',
				name: form.name,
				expectedAmount: form.expectedAmount,
				cadence: form.cadence,
				memberIds: [...selected],
			});
			setNote({ kind: 'ok', text: 'Group created.' });
			setSelected(new Set());
			setFormOpen(false);
			setForm({ name: '', expectedAmount: '', cadence: 'monthly' });
			await load();
		} catch (err) {
			setNote({ kind: 'err', text: err instanceof Error ? err.message : 'Could not create the group' });
		}
	}, [form, selected, post, load]);

	const toggle = (id: string) =>
		setSelected((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});

	return (
		<section className="cb">
			<header className="cb__head">
				<h2 className="cb__title">{heading}</h2>
				<span className="cb__count">{signups.length}</span>
				<span className="cb__spacer" />
				{/* Always available, not only once someone is selected: the control that
				    makes the FIRST tin cannot be hidden behind having tins to select
				    people for. With a selection it seats them; without one it makes an
				    empty tin to drag people into. */}
				<button className="cb__btn cb__btn--go" type="button" onClick={() => setFormOpen((v) => !v)}>
					{selected.size > 0 ? `New tin (${selected.size} selected)` : 'New tin'}
				</button>
			</header>

			{note && (
				<p className={`cb__note cb__note--${note.kind}`} role="status">{note.text}</p>
			)}

			{formOpen && (
				<div className="cb__form">
					<input
						className="cb__in" placeholder="Group name" value={form.name}
						onChange={(e) => setForm({ ...form, name: e.target.value })}
					/>
					{/* Amount and cadence are asked rather than defaulted: a circle carrying a
					    made-up contribution figure is not a draft, it is wrong data someone
					    will later read as a decision. */}
					<input
						className="cb__in cb__in--sm" placeholder="Amount each" inputMode="decimal"
						value={form.expectedAmount}
						onChange={(e) => setForm({ ...form, expectedAmount: e.target.value })}
					/>
					<select
						className="cb__in cb__in--sm" value={form.cadence}
						onChange={(e) => setForm({ ...form, cadence: e.target.value })}
					>
						<option value="weekly">Weekly</option>
						<option value="biweekly">Biweekly</option>
						<option value="monthly">Monthly</option>
					</select>
					<button className="cb__btn cb__btn--go" type="button" disabled={busy} onClick={generate}>
						Create
					</button>
					<button className="cb__btn" type="button" onClick={() => setFormOpen(false)}>Cancel</button>
				</div>
			)}

			{/* ── The task bar ──────────────────────────────────────────────────── */}
			<div className="cb__bar">
				{signups.length === 0 ? (
					<p className="cb__empty">Nobody is waiting. New signups appear here.</p>
				) : signups.map((s) => (
					<div
						key={s.memberId}
						className={[
							'cb__chip',
							selected.has(s.memberId) ? 'cb__chip--sel' : '',
							s.pendingVote ? 'cb__chip--pending' : '',
							dragging === s.memberId ? 'cb__chip--drag' : '',
						].join(' ')}
						draggable
						onDragStart={() => setDragging(s.memberId)}
						onDragEnd={() => { setDragging(null); setOver(null); }}
						onClick={() => toggle(s.memberId)}
						title={s.email ?? undefined}
					>
						<span className="cb__chipname">{label(s)}</span>
						{s.pendingVote && <span className="cb__pending" title="An admission vote is already open">vote open</span>}
					</div>
				))}
			</div>

			{/* ── The tins ──────────────────────────────────────────────────────── */}
			<div className="cb__grid">
				{circles.length === 0 ? (
					<p className="cb__empty">No circles yet. Select people above and generate one.</p>
				) : circles.map((c) => {
					const forming = c.status === 'forming';
					return (
						<div
							key={c.id}
							className={[
								'cb__tin',
								forming ? 'cb__tin--forming' : 'cb__tin--active',
								over === c.id ? 'cb__tin--over' : '',
							].join(' ')}
							// preventDefault is what makes an element a drop target at all.
							// Both states accept the drop — they simply mean different things.
							onDragOver={(e) => { if (dragging) { e.preventDefault(); setOver(c.id); } }}
							onDragLeave={() => setOver((v) => (v === c.id ? null : v))}
							onDrop={(e) => { e.preventDefault(); void drop(c.id); }}
						>
							<div className="cb__tinhead">
								<span className="cb__tinname">{c.name}</span>
								<span className={`cb__status cb__status--${c.status}`}>{c.status}</span>
							</div>
							<div className="cb__tinmeta">
								{c.expectedAmount} {c.currency} · {c.cadence}
							</div>
							<div className="cb__tinfoot">
								{c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
								{dragging && (
									<span className="cb__hint">
										{forming ? 'drop to place' : 'drop to open a vote'}
									</span>
								)}
							</div>
						</div>
					);
				})}
			</div>

			<p className="cb__foot">
				Dropping onto a forming circle places someone directly. Dropping onto an active
				circle opens an admission vote — the group decides, not the organizer.
			</p>
		</section>
	);
}
