/**
 * trafficChart.client.ts — fetch a series and draw it as SVG bars.
 *
 * SVG built with createElementNS rather than innerHTML: bucket labels come from the
 * database and this renders in the admin origin, so nothing is interpolated as markup.
 */

const NS = 'http://www.w3.org/2000/svg';

const root = () => document.getElementById('traffic-chart');

function el(name: string, attrs: Record<string, string | number>): SVGElement {
	const node = document.createElementNS(NS, name);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
	return node;
}

/** Short label per view — a 30-bar axis cannot carry full dates. */
function tick(bucket: string, view: string): string {
	if (view === 'month') {
		const [y, m] = bucket.split('-');
		return `${['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m)]} ${y.slice(2)}`;
	}
	const [, m, d] = bucket.split('-');
	return `${m}/${d}`;
}

function draw(points: Array<{ bucket: string; hits: number; errors: number }>, view: string): SVGElement {
	const W = Math.max(560, points.length * 26);
	const H = 180;
	const PAD = { l: 40, r: 8, t: 10, b: 26 };
	const innerW = W - PAD.l - PAD.r;
	const innerH = H - PAD.t - PAD.b;

	const max = Math.max(1, ...points.map((p) => p.hits));
	const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });

	// Three gridlines and their values — enough to read a magnitude, few enough not to
	// compete with the bars.
	for (let i = 0; i <= 2; i++) {
		const value = Math.round((max / 2) * i);
		const y = PAD.t + innerH - (value / max) * innerH;
		svg.appendChild(el('line', { class: 'tc__grid', x1: PAD.l, y1: y, x2: W - PAD.r, y2: y }));
		const label = el('text', { class: 'tc__axis', x: 4, y: y + 3 });
		label.textContent = value.toLocaleString();
		svg.appendChild(label);
	}

	// Cap the slot width. Dividing the full width by the point count means a single
	// day's data draws one bar across the whole chart, which reads as a filled panel
	// rather than a measurement — the shape says "everything" when the number is one.
	const MAX_SLOT = 48;
	const bw = Math.min(innerW / Math.max(points.length, 1), MAX_SLOT);

	points.forEach((p, i) => {
		const x = PAD.l + i * bw;
		const h = (p.hits / max) * innerH;
		const errH = p.hits ? (p.errors / max) * innerH : 0;

		const bar = el('rect', {
			class: 'tc__bar',
			x: x + bw * 0.15,
			y: PAD.t + innerH - h,
			width: Math.max(1, bw * 0.7),
			height: Math.max(p.hits > 0 ? 1 : 0, h - errH),
		});
		const title = el('title', {});
		title.textContent = `${p.bucket}: ${p.hits.toLocaleString()} requests${p.errors ? `, ${p.errors} server errors` : ''}`;
		bar.appendChild(title);
		svg.appendChild(bar);

		if (errH > 0) {
			svg.appendChild(el('rect', {
				class: 'tc__bar tc__bar--err',
				x: x + bw * 0.15,
				y: PAD.t + innerH - h,
				width: Math.max(1, bw * 0.7),
				height: errH,
			}));
		}

		// Label every bar when there is room, otherwise every third.
		if (points.length <= 14 || i % 3 === 0) {
			const t = el('text', { class: 'tc__axis', x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' });
			t.textContent = tick(p.bucket, view);
			svg.appendChild(t);
		}
	});

	// Below a handful of points the axis alone does not make the scale obvious, so say
	// it outright. A chart with two bars and no context invites reading a doubling as a
	// trend when it is two requests.
	if (points.length < 5) {
		const note = el('text', {
			class: 'tc__axis',
			x: PAD.l + points.length * bw + 12,
			y: PAD.t + innerH / 2,
		});
		note.textContent = points.length === 1 ? 'first day of data' : 'building up';
		svg.appendChild(note);
	}

	return svg;
}

async function load(view: string): Promise<void> {
	const host = root();
	const body = host?.querySelector<HTMLElement>('.tc__body');
	const total = host?.querySelector<HTMLElement>('.tc__total');
	if (!host || !body) return;

	body.textContent = 'Loading…';
	try {
		const res = await fetch(`/api/admin/traffic?view=${encodeURIComponent(view)}`);
		const data = await res.json();
		if (!data.ok) throw new Error(data.error ?? 'Could not load');

		body.textContent = '';
		if (total) total.textContent = data.total ? `${data.total.toLocaleString()} requests` : '';

		if (!data.points.length) {
			const p = document.createElement('p');
			p.className = 'tc__empty';
			// Distinguishes "no traffic yet" from "broken", which is the exact confusion
			// that hid the missing tables in the first place.
			p.textContent = 'No traffic recorded yet. Requests are counted from now on.';
			body.appendChild(p);
			return;
		}
		body.appendChild(draw(data.points, view));
	} catch (err) {
		body.textContent = err instanceof Error ? err.message : 'Could not load traffic';
	}
}

document.addEventListener('click', (e) => {
	const btn = (e.target as Element).closest<HTMLButtonElement>('.tc__view');
	if (!btn?.dataset.view) return;
	root()?.querySelectorAll('.tc__view').forEach((b) => b.classList.remove('tc__view--on'));
	btn.classList.add('tc__view--on');
	void load(btn.dataset.view);
});

void load('day');

// This file is a MODULE, not a global script. Without an import or export, TypeScript
// treats a .ts file as a global script and its top-level names share one scope with
// every other such file — which is how two unrelated client scripts both defining
// load() became a duplicate-implementation error.
export {};
