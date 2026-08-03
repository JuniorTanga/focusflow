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
  dayNumber,
  PRINCIPLES
} from '../renderer/logic.js';

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

test('principleOfDay is stable per date and covers all principles', () => {
  const a = principleOfDay(new Date(2026, 7, 2));
  const b = principleOfDay(new Date(2026, 7, 2, 23, 59));
  assert.equal(a, b);
  const seen = new Set();
  for (let i = 0; i < PRINCIPLES.length; i++) {
    seen.add(principleOfDay(new Date(2026, 0, 1 + i)).name);
  }
  assert.equal(seen.size, PRINCIPLES.length);
});

test('dayNumber is monotonic across days', () => {
  assert.ok(dayNumber(new Date(2026, 7, 3)) > dayNumber(new Date(2026, 7, 2)));
  assert.equal(dayNumber(new Date(2026, 7, 2, 1)), dayNumber(new Date(2026, 7, 2, 23)));
});
