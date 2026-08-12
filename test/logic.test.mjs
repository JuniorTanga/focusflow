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

test('partitionTasks does not promote a task deferred to tomorrow/week', () => {
  const today = task({ title: 't', due: 'today', now: new Date(2026, 7, 2, 8) });
  const tomorrow = task({ title: 'tm', due: 'tomorrow', now: new Date(2026, 7, 2, 9) });
  const week = task({ title: 'w', due: 'week', now: new Date(2026, 7, 2, 10) });
  const { next, backlog } = partitionTasks([tomorrow, week, today], NOON);
  assert.equal(next.title, 't');
  assert.deepEqual(backlog.map((t) => t.title), ['tm', 'w']);
  const only = partitionTasks([tomorrow], NOON);
  assert.equal(only.next, null);
  assert.deepEqual(only.backlog.map((t) => t.title), ['tm']);
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
