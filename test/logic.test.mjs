import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTask,
  createGroup,
  sortTasks,
  partitionTasks,
  pruneOldCompletions,
  validateReason,
  resolveDueForReschedule,
  guessDue,
  rolloverDue,
  dueDateFor,
  greetingFor,
  principleOfDay,
  timeBucket,
  dayNumber
} from '../renderer/logic.js';
import { GREETINGS, PRINCIPLES } from '../renderer/i18n.js';

const NOON = new Date(2026, 7, 2, 12, 0, 0);
const ISO = (d) => d.toISOString();

function task(overrides = {}) {
  return createTask({ title: 'Task', now: NOON, ...overrides });
}

test('createTask applies defaults', () => {
  const t = createTask({ title: 'Write report' });
  assert.equal(t.priority, 'medium');
  assert.equal(t.due, 'today');
  assert.equal(t.whenWhere, null);
  assert.equal(t.timebox, null);
  assert.equal(t.completedAt, null);
  assert.equal(t.groupId, null);
  assert.equal(t.lastPostponeReason, null);
  assert.ok(t.id);
});

test('createTask keeps a provided groupId', () => {
  const t = createTask({ title: 'Write report', groupId: 'g1' });
  assert.equal(t.groupId, 'g1');
});

test('createGroup builds a group and trims its name', () => {
  const g = createGroup({ name: '  Work  ', color: '#123456' });
  assert.equal(g.name, 'Work');
  assert.equal(g.color, '#123456');
  assert.ok(g.id);
  assert.ok(g.createdAt);
});

test('sortTasks orders by due, then priority, then created', () => {
  const todayLow = task({ title: 'a', due: 'today', priority: 'low', now: new Date(2026, 7, 2, 8) });
  const todayHigh = task({ title: 'b', due: 'today', priority: 'high', now: new Date(2026, 7, 2, 9) });
  const tomorrow = task({ title: 'c', due: 'tomorrow', priority: 'high', now: new Date(2026, 7, 2, 10) });
  const week = task({ title: 'd', due: 'week', priority: 'high', now: new Date(2026, 7, 2, 11) });
  const ordered = sortTasks([week, tomorrow, todayHigh, todayLow]);
  assert.deepEqual(ordered.map((t) => t.title), ['b', 'a', 'c', 'd']);
});

test('partitionTasks splits next, backlog and done-today', () => {
  const a = task({ title: 'next', now: new Date(2026, 7, 2, 8) });
  const b = task({ title: 'backlog1', now: new Date(2026, 7, 2, 9) });
  const c = task({ title: 'backlog2', now: new Date(2026, 7, 2, 10) });
  const doneNow = task({ title: 'done', completedAt: new Date(2026, 7, 2, 9).toISOString() });
  const doneYesterday = task({ title: 'old', completedAt: new Date(2026, 7, 1, 9).toISOString() });
  const { next, backlog, doneToday } = partitionTasks([c, b, a, doneNow, doneYesterday], NOON);
  assert.equal(next.title, 'next');
  assert.deepEqual(backlog.map((t) => t.title), ['backlog1', 'backlog2']);
  assert.deepEqual(doneToday.map((t) => t.title), ['done']);
});

test('partitionTasks makes the pinned task the active next task', () => {
  const a = task({ title: 'a', priority: 'high', now: new Date(2026, 7, 2, 8) });
  const b = task({ title: 'b', priority: 'low', now: new Date(2026, 7, 2, 9) });
  const { next, backlog } = partitionTasks([a, b], NOON, b.id);
  assert.equal(next.title, 'b');
  assert.deepEqual(backlog.map((t) => t.title), ['a']);
});

test('partitionTasks ignores a stale or completed pinned id', () => {
  const a = task({ title: 'a', priority: 'high', now: new Date(2026, 7, 2, 8) });
  const done = task({ title: 'done', completedAt: new Date(2026, 7, 2, 9).toISOString() });
  const { next, backlog } = partitionTasks([a, done], NOON, done.id);
  assert.equal(next.title, 'a');
  assert.deepEqual(backlog.map((t) => t.title), []);
  assert.equal(partitionTasks([a], NOON, 'does-not-exist').next.title, 'a');
});

test('a deferred task is skipped while a today task exists, but returns when alone', () => {
  const today = task({ title: 't', due: 'today', now: new Date(2026, 7, 2, 8) });
  const tomorrow = task({ title: 'tm', due: 'tomorrow', now: new Date(2026, 7, 2, 9) });
  const week = task({ title: 'w', due: 'week', now: new Date(2026, 7, 2, 10) });
  const mixed = partitionTasks([tomorrow, week, today], NOON);
  assert.equal(mixed.next.title, 't');
  assert.deepEqual(mixed.backlog.map((t) => t.title), ['tm', 'w']);
  const alone = partitionTasks([tomorrow], NOON);
  assert.equal(alone.next.title, 'tm');
  assert.deepEqual(alone.backlog, []);
});

test('partitionTasks promotes another due-today task when the hero is deferred', () => {
  const a = task({ title: 'a', due: 'today', priority: 'high', now: new Date(2026, 7, 2, 8) });
  const b = task({ title: 'b', due: 'today', priority: 'low', now: new Date(2026, 7, 2, 9) });
  const deferredA = { ...a, due: 'tomorrow' };
  const { next, backlog } = partitionTasks([deferredA, b], NOON);
  assert.equal(next.title, 'b');
  assert.deepEqual(backlog.map((t) => t.title), ['a']);
});

test('partitionTasks keeps a pinned deferred task as the active next task', () => {
  const a = task({ title: 'a', due: 'today', now: new Date(2026, 7, 2, 8) });
  const w = task({ title: 'w', due: 'week', now: new Date(2026, 7, 2, 9) });
  const { next, backlog } = partitionTasks([a, w], NOON, w.id);
  assert.equal(next.title, 'w');
  assert.deepEqual(backlog.map((t) => t.title), ['a']);
});

test('a task postponed later-today leaves the hero and lets another today task promote', () => {
  const a = task({ title: 'a', priority: 'high', now: new Date(2026, 7, 2, 8) });
  const b = task({ title: 'b', priority: 'low', now: new Date(2026, 7, 2, 9) });
  const postponedA = { ...a, postponedAt: new Date(2026, 7, 2, 10).toISOString() };
  const { next, backlog } = partitionTasks([postponedA, b], NOON);
  assert.equal(next.title, 'b');
  assert.deepEqual(backlog.map((t) => t.title), ['a']);
});

test('hero falls back to a postponed task when all other tasks are done', () => {
  const a = task({ title: 'a', priority: 'high', now: new Date(2026, 7, 2, 8) });
  const postponedA = { ...a, postponedAt: new Date(2026, 7, 2, 10).toISOString() };
  const b = task({ title: 'b', priority: 'low', now: new Date(2026, 7, 2, 9) });
  const withB = partitionTasks([postponedA, b], NOON);
  assert.equal(withB.next.title, 'b');
  const alone = partitionTasks([postponedA], NOON);
  assert.equal(alone.next.title, 'a');
});

test('a postponed-today task returns to the hero the next day', () => {
  const a = task({ title: 'a', now: new Date(2026, 7, 2, 8) });
  const postponedYesterday = { ...a, postponedAt: new Date(2026, 7, 1, 9).toISOString() };
  const { next } = partitionTasks([postponedYesterday], NOON);
  assert.equal(next.title, 'a');
});

test('pinning a postponed-today task forces it back to the hero', () => {
  const a = task({ title: 'a', now: new Date(2026, 7, 2, 8) });
  const b = task({ title: 'b', now: new Date(2026, 7, 2, 9) });
  const postponedA = { ...a, postponedAt: new Date(2026, 7, 2, 10).toISOString() };
  const { next, backlog } = partitionTasks([postponedA, b], NOON, a.id);
  assert.equal(next.title, 'a');
  assert.deepEqual(backlog.map((t) => t.title), ['b']);
});

test('pruneOldCompletions drops completed tasks from earlier days', () => {
  const kept = task({ title: 'today', completedAt: new Date(2026, 7, 2, 9).toISOString() });
  const dropped = task({ title: 'old', completedAt: new Date(2026, 7, 1, 9).toISOString() });
  const pending = task({ title: 'pending' });
  const result = pruneOldCompletions([kept, dropped, pending], NOON);
  assert.deepEqual(result.map((t) => t.title).sort(), ['pending', 'today']);
});

test('validateReason requires a real reason', () => {
  assert.equal(validateReason(''), false);
  assert.equal(validateReason('   '), false);
  assert.equal(validateReason('too short'), false);
  assert.equal(validateReason('running behind on another thing'), true);
});
test('resolveDueForReschedule maps to valid buckets', () => {
  assert.equal(resolveDueForReschedule('tomorrow'), 'tomorrow');
  assert.equal(resolveDueForReschedule('week'), 'week');
  assert.equal(resolveDueForReschedule('today'), 'today');
  assert.equal(resolveDueForReschedule('never'), 'today');
});

test('guessDue reads date clues from when/where notes', () => {
  assert.equal(guessDue('At my desk, after lunch'), 'today');
  assert.equal(guessDue('Send report tomorrow at the office'), 'tomorrow');
  assert.equal(guessDue('Finish this by friday'), 'week');
  assert.equal(guessDue('This weekend'), 'week');
  assert.equal(guessDue('Call her in 1 day'), 'tomorrow');
  assert.equal(guessDue('Ship it in 3 days'), 'week');
  assert.equal(guessDue('demain matin'), 'tomorrow');
  assert.equal(guessDue('Rendu vendredi prochain'), 'week');
  assert.equal(guessDue('Ce soir à la maison'), 'today');
  assert.equal(guessDue('à mon bureau'), null);
  assert.equal(guessDue('At my desk'), null);
  assert.equal(guessDue(''), null);
  assert.equal(guessDue('   '), null);
});

test('guessDue folds accents and hyphens, reads word numbers', () => {
  assert.equal(guessDue('Rendez-vous après-demain'), 'tomorrow');
  assert.equal(guessDue('hand in before friday'), 'week');
  assert.equal(guessDue('rendu avant vendredi'), 'week');
  assert.equal(guessDue('start next Monday'), 'week');
  assert.equal(guessDue('call in two days'), 'week');
  assert.equal(guessDue('appeler dans trois jours'), 'week');
  assert.equal(guessDue('finish in a day'), 'tomorrow');
  assert.equal(guessDue('dans un jour'), 'tomorrow');
  assert.equal(guessDue('ship it in a week'), 'week');
  assert.equal(guessDue('rendez-vous dans une semaine'), 'week');
  assert.equal(guessDue("in a couple of days"), 'week');
  assert.equal(guessDue('in the morning'), 'today');
  assert.equal(guessDue("aujourd'hui"), 'today');
  assert.equal(guessDue('Build the knowledge base'), null);
});

test('guessDue favors the closest due when several clues collide', () => {
  assert.equal(guessDue('today but also friday'), 'today');
  assert.equal(guessDue('demain soir sinon ce soir'), 'today');
  assert.equal(guessDue('in 2 days or tomorrow'), 'tomorrow');
});

test('timeBucket matches the hour', () => {
  assert.equal(timeBucket(new Date(2026, 7, 2, 6)), 'morning');
  assert.equal(timeBucket(new Date(2026, 7, 2, 14)), 'afternoon');
  assert.equal(timeBucket(new Date(2026, 7, 2, 20)), 'evening');
  assert.equal(timeBucket(new Date(2026, 7, 2, 23)), 'night');
});

test('greetingFor is stable within a day and reacts to progress', () => {
  const g = greetingFor(new Date(2026, 7, 2, 14), 0);
  const g2 = greetingFor(new Date(2026, 7, 2, 14, 30), 0);
  assert.deepEqual(g, g2);
  const progressed = greetingFor(new Date(2026, 7, 2, 14), 3);
  assert.notEqual(g.label + g.line, progressed.label + progressed.line);
  assert.ok(g.label.length > 0 && g.line.length > 0);
});

test('greetingFor inserts the user name into the label', () => {
  const g = greetingFor(new Date(2026, 7, 2, 9), 0, 'Sarah');
  assert.match(g.label, /Sarah/);
  const plain = greetingFor(new Date(2026, 7, 2, 9), 0, null);
  assert.equal(plain.label.includes('Sarah'), false);
});

test('greetingFor supports French', () => {
  const en = greetingFor(new Date(2026, 7, 2, 9), 0, null, 'en');
  const fr = greetingFor(new Date(2026, 7, 2, 9), 0, null, 'fr');
  assert.notEqual(en.label, fr.label);
  assert.ok(GREETINGS.fr.morning.none.some((p) => p.label === fr.label));
  assert.ok(GREETINGS.en.morning.none.some((p) => p.label === en.label));
});

test('principleOfDay is stable per date and covers all principles', () => {
  const a = principleOfDay(new Date(2026, 7, 2));
  const b = principleOfDay(new Date(2026, 7, 2, 23, 59));
  assert.equal(a, b);
  const seen = new Set();
  for (let i = 0; i < PRINCIPLES.en.length; i++) {
    seen.add(principleOfDay(new Date(2026, 0, 1 + i)).name);
  }
  assert.equal(seen.size, PRINCIPLES.en.length);
});

test('principleOfDay supports French', () => {
  const d = new Date(2026, 7, 2);
  const en = principleOfDay(d, 'en');
  const fr = principleOfDay(d, 'fr');
  assert.equal(fr.name, PRINCIPLES.fr[dayNumber(d) % PRINCIPLES.fr.length].name);
  assert.equal(en.name, PRINCIPLES.en[dayNumber(d) % PRINCIPLES.en.length].name);
  assert.notEqual(en.line, fr.line);
  assert.ok(fr.name.length > 0 && fr.why.length > 0);
});

test('dayNumber is monotonic across days', () => {
  assert.ok(dayNumber(new Date(2026, 7, 3)) > dayNumber(new Date(2026, 7, 2)));
  assert.equal(dayNumber(new Date(2026, 7, 2, 1)), dayNumber(new Date(2026, 7, 2, 23)));
});

test('createTask stamps the dueDate matching the due bucket', () => {
  assert.equal(task({ title: 't' }).dueDate, '2026-08-02');
  assert.equal(task({ title: 't', due: 'tomorrow' }).dueDate, '2026-08-03');
  const wk = task({ title: 't', due: 'week', now: new Date(2026, 7, 3, 9) });
  assert.equal(wk.dueDate, '2026-08-09');
  assert.equal(dueDateFor('week', new Date(2026, 7, 2)), '2026-08-02');
  assert.equal(dueDateFor('tomorrow', new Date(2026, 7, 2)), '2026-08-03');
  assert.equal(dueDateFor('today', new Date(2026, 7, 2)), '2026-08-02');
});

test('rolloverDue turns a tomorrow task into today once its day arrives', () => {
  const t = task({ title: 't', due: 'tomorrow', now: new Date(2026, 7, 2, 9) });
  const sameDay = rolloverDue([t], new Date(2026, 7, 2, 12));
  assert.equal(sameDay.changed, false);
  assert.equal(sameDay.tasks[0].due, 'tomorrow');
  const nextDay = rolloverDue([t], new Date(2026, 7, 3, 7));
  assert.equal(nextDay.changed, true);
  assert.equal(nextDay.tasks[0].due, 'today');
  assert.equal(nextDay.tasks[0].dueDate, '2026-08-03');
  const later = rolloverDue([t], new Date(2026, 7, 4, 7));
  assert.equal(later.tasks[0].due, 'today');
  assert.equal(later.tasks[0].dueDate, '2026-08-03');
});

test('rolloverDue promotes a week task only after the week closes', () => {
  const t = task({ title: 't', due: 'week', now: new Date(2026, 7, 3, 9) });
  const during = rolloverDue([t], new Date(2026, 7, 8, 9));
  assert.equal(during.changed, false);
  assert.equal(during.tasks[0].due, 'week');
  const after = rolloverDue([t], new Date(2026, 7, 10, 9));
  assert.equal(after.changed, true);
  assert.equal(after.tasks[0].due, 'today');
  assert.equal(after.tasks[0].dueDate, '2026-08-09');
});

test('rolloverDue leaves completed tasks alone and keeps carried-over urgency', () => {
  const done = task({ title: 'done', due: 'tomorrow', completedAt: new Date(2026, 7, 2, 9).toISOString() });
  const today = task({ title: 't', now: new Date(2026, 7, 3, 9) });
  const res = rolloverDue([done, today], new Date(2026, 7, 5, 9));
  assert.equal(res.changed, false);
  assert.equal(res.tasks[0].due, 'tomorrow');
  assert.equal(res.tasks[1].due, 'today');
  assert.equal(res.tasks[1].dueDate, '2026-08-03');
});

test('rolloverDue migrates legacy tasks that lack a dueDate', () => {
  const legacy = { ...task({ title: 'legacy', priority: 'high' }), due: 'week' };
  delete legacy.dueDate;
  legacy.createdAt = new Date(2026, 7, 16, 9).toISOString();
  const res = rolloverDue([legacy], new Date(2026, 7, 17, 9));
  assert.equal(res.changed, true);
  assert.equal(res.tasks[0].due, 'today');
  assert.equal(res.tasks[0].dueDate, '2026-08-16');
});

test('the most overdue task wins the today pool and the hero', () => {
  const lateWeek = task({ title: 'a', now: new Date(2026, 7, 2, 9) });
  const yesterday = task({ title: 'b', priority: 'high', now: new Date(2026, 7, 1, 9) });
  const fresh = task({ title: 'c', now: new Date(2026, 7, 3, 9) });
  const ordered = sortTasks([fresh, lateWeek, yesterday], new Date(2026, 7, 3, 9));
  assert.deepEqual(ordered.map((t) => t.title), ['b', 'a', 'c']);
  const { next } = partitionTasks([fresh, lateWeek, yesterday], new Date(2026, 7, 3, 9));
  assert.equal(next.title, 'b');
});

test('a pinned task overrides overdue ordering', () => {
  const lateWeek = task({ title: 'late', now: new Date(2026, 7, 2, 9) });
  const fresh = task({ title: 'fresh', now: new Date(2026, 7, 3, 9) });
  const { next } = partitionTasks([lateWeek, fresh], new Date(2026, 7, 3, 9), fresh.id);
  assert.equal(next.title, 'fresh');
});
