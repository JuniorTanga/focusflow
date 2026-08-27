import { GREETINGS, PRINCIPLES } from './i18n.js';

export const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
export const DUE_ORDER = { today: 0, tomorrow: 1, week: 2 };
export const PRIORITIES = Object.keys(PRIORITY_ORDER);
export const DUES = Object.keys(DUE_ORDER);

export function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dayNumber(now) {
  const d = new Date(now);
  const localMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(localMidnight.getTime() / 86400000);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function dateKey(date) {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function endOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return d;
}

export function dueDateFor(due, now = new Date()) {
  if (due === 'tomorrow') return dateKey(addDays(now, 1));
  if (due === 'week') return dateKey(endOfWeek(now));
  return dateKey(now);
}

function keyDays(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function overdueDays(task, now) {
  if (!task.dueDate) return 0;
  return Math.max(0, keyDays(dateKey(now)) - keyDays(task.dueDate));
}

export function createTask({ title, whenWhere = null, priority = 'medium', timebox = null, due = 'today', completedAt = null, groupId = null, lastPostponeReason = null, postponedAt = null, now = new Date() }) {
  return {
    id: newId(),
    title,
    whenWhere,
    priority,
    timebox,
    due,
    dueDate: dueDateFor(due, now),
    groupId,
    lastPostponeReason,
    postponedAt,
    createdAt: now.toISOString(),
    completedAt
  };
}

export function createGroup({ name, color = null, now = new Date() }) {
  return {
    id: newId(),
    name: String(name ?? '').trim(),
    color,
    createdAt: now.toISOString()
  };
}

function bucketRank(task) {
  return DUE_ORDER[task.due] ?? DUE_ORDER.today;
}

export function sortTasks(tasks, now = new Date()) {
  return [...tasks].sort((a, b) => {
    const byBucket = bucketRank(a) - bucketRank(b);
    if (byBucket !== 0) return byBucket;
    const byOverdue = overdueDays(b, now) - overdueDays(a, now);
    if (byOverdue !== 0) return byOverdue;
    const byPriority = (PRIORITY_ORDER[a.priority] ?? PRIORITY_ORDER.medium) - (PRIORITY_ORDER[b.priority] ?? PRIORITY_ORDER.medium);
    if (byPriority !== 0) return byPriority;
    return Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0);
  });
}

export function partitionTasks(tasks, now = new Date(), activeTaskId = null) {
  const incomplete = sortTasks(tasks.filter((t) => !t.completedAt), now);
  const active = activeTaskId ? incomplete.find((t) => t.id === activeTaskId) ?? null : null;
  const postponedToday = (t) => t.postponedAt && isSameDay(new Date(t.postponedAt), now);
  const todayPool = incomplete.filter((t) => (t.due ?? 'today') === 'today' && !postponedToday(t));
  const next = active ?? todayPool[0] ?? incomplete[0] ?? null;
  const doneToday = tasks
    .filter((t) => t.completedAt && isSameDay(new Date(t.completedAt), now))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  const backlog = incomplete.filter((t) => t !== next);
  return { next, backlog, doneToday };
}

export function pruneOldCompletions(tasks, now = new Date()) {
  return tasks.filter((t) => !t.completedAt || isSameDay(new Date(t.completedAt), now));
}

export function validateReason(text) {
  return text != null && text.trim().length >= 10;
}

export function resolveDueForReschedule(due) {
  return due === 'tomorrow' || due === 'week' ? due : 'today';
}

const DAY_NUMBERS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2, few: 3,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
  sept: 7, huit: 8, neuf: 9, dix: 10, quelques: 3, plusieurs: 4
};

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NUMBER_TOKENS = ['a couple', 'a few', ...Object.keys(DAY_NUMBERS)]
  .sort((a, b) => b.length - a.length);

const RE_IN_DAYS = new RegExp(
  `\\b(?:in|dans)\\s+(?:(\\d+)|(${NUMBER_TOKENS.map(escRe).join('|')}))\\s*(?:of\\s+)?(?:days?|day|jours?|jour)\\b`
);
const RE_IN_WEEK = new RegExp('\\b(?:in|dans)\\s+(?:a|an|the|one|un|une)\\s+(?:week|semaine)\\b');

const HINTS = {
  today: [
    'later today', 'today', 'tonight', 'this morning', 'this afternoon', 'this evening',
    'in the morning', 'in the afternoon', 'in the evening', 'after lunch', 'after work',
    'asap', 'right now', 'now',
    "aujourd hui", 'ce matin', 'cet apres midi', 'cette apres midi', 'ce soir',
    'apres le dejeuner', 'apres le travail', 'maintenant', 'tout de suite'
  ],
  tomorrow: [
    'tomorrow', 'tmrw', 'demain', 'day after tomorrow', 'after tomorrow', 'apres demain',
    'demain matin', 'demain soir'
  ],
  week: [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
    'this week', 'next week', 'this weekend', 'the weekend', 'weekend', 'week end',
    'end of week', 'end of the week', 'eow',
    'cette semaine', 'la semaine prochaine', 'semaine prochaine',
    'ce week end', 'le week end', 'fin de semaine'
  ]
};

function hintRegex(tokens) {
  const sorted = tokens.length > 1 ? [...tokens].sort((a, b) => b.length - a.length) : tokens;
  return new RegExp(`\\b(?:${sorted.map(escRe).join('|')})\\b`);
}

const RE_TODAY = hintRegex(HINTS.today);
const RE_TOMORROW = hintRegex(HINTS.tomorrow);
const RE_WEEK = hintRegex(HINTS.week);

function normalizeNote(note) {
  return ` ${String(note).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[\p{Pd}_\s,.;:!?']+/gu, ' ')} `;
}

function inDaysBucket(text) {
  const m = text.match(RE_IN_DAYS);
  if (m) return (m[1] != null ? parseInt(m[1], 10) : DAY_NUMBERS[m[2]]) === 1 ? 'tomorrow' : 'week';
  return RE_IN_WEEK.test(text) ? 'week' : null;
}

export function guessDue(note = '') {
  const text = normalizeNote(note);
  const days = inDaysBucket(text);
  if (RE_TODAY.test(text)) return 'today';
  if (RE_TOMORROW.test(text) || days === 'tomorrow') return 'tomorrow';
  if (RE_WEEK.test(text) || days === 'week') return 'week';
  return null;
}

function legacyDueDate(t, due, now) {
  const base = new Date(t.postponedAt || t.createdAt || now);
  if (due === 'tomorrow') return dateKey(addDays(base, 1));
  if (due === 'week') return dateKey(endOfWeek(base));
  return dateKey(base);
}

export function rolloverDue(tasks, now = new Date()) {
  const todayK = dateKey(now);
  let changed = false;
  const next = tasks.map((t) => {
    if (t.completedAt) return t;
    const due = t.due ?? 'today';
    const dueDate = t.dueDate || legacyDueDate(t, due, now);
    let newDue = due;
    if (due === 'tomorrow' && dueDate <= todayK) newDue = 'today';
    else if (due === 'week' && dueDate < todayK) newDue = 'today';
    if (t.dueDate === dueDate && newDue === due) return t;
    changed = true;
    return { ...t, due: newDue, dueDate };
  });
  return changed ? { tasks: next, changed: true } : { tasks, changed: false };
}

export function timeBucket(now = new Date()) {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

function stateClass(doneCount) {
  if (doneCount <= 0) return 'none';
  if (doneCount === 1) return 'one';
  return 'many';
}

export function greetingFor(now = new Date(), doneCount = 0, name = null, lang = 'en') {
  const bucket = timeBucket(now);
  const dict = GREETINGS[lang] ?? GREETINGS.en;
  const pool = dict[bucket][stateClass(doneCount)];
  const pick = pool[dayNumber(now) % pool.length];
  const label = name ? pick.label.replace(/\.$/, '') + `, ${name}.` : pick.label;
  return {
    bucket,
    label: label.replace(/\bN\b/g, String(doneCount)),
    line: pick.line.replace(/\bN\b/g, String(doneCount))
  };
}

export function principleOfDay(now = new Date(), lang = 'en') {
  const dict = PRINCIPLES[lang] ?? PRINCIPLES.en;
  return dict[dayNumber(now) % dict.length];
}
