// The susu card's slot glyphs, in one place — shared by the React island (client)
// and the printable export page (server). Kept in its own module with NO db import
// so the client bundle never pulls the server-only card queries.
//
// Glyphs, not colors (SusuData §4): shape carries the meaning, so the row survives a
// color-blind reader and a grayscale print of the card she hands to a lender.

export type SlotState = 'on_time' | 'late' | 'turn' | 'missed' | 'pending';

export const SLOT_GLYPH: Record<SlotState, string> = {
	on_time: '★', // paid on time (or early)
	late: '☆',    // paid, but late — or made good after grace (repaid). Still a star.
	turn: '◆',    // her round: the circle pays her, so no payment was owed
	missed: '○',  // past grace and still unpaid — the one open-debt state
	pending: '·', // not yet due, inside grace, or a slot not reached — no judgment yet
};
