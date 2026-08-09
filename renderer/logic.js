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

export function createTask({ title, whenWhere = null, priority = 'medium', timebox = null, due = 'today', completedAt = null, groupId = null, lastPostponeReason = null, now = new Date() }) {
  return {
    id: newId(),
    title,
    whenWhere,
    priority,
    timebox,
    due,
    groupId,
    lastPostponeReason,
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

function taskRank(task) {
  const due = DUE_ORDER[task.due] ?? DUE_ORDER.today;
  const priority = PRIORITY_ORDER[task.priority] ?? PRIORITY_ORDER.medium;
  return due * 1000 + priority * 100;
}

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const byRank = taskRank(a) - taskRank(b);
    if (byRank !== 0) return byRank;
    return Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0);
  });
}

export function partitionTasks(tasks, now = new Date(), activeTaskId = null) {
  const incomplete = sortTasks(tasks.filter((t) => !t.completedAt));
  const active = activeTaskId ? incomplete.find((t) => t.id === activeTaskId) ?? null : null;
  const next = active ?? incomplete[0] ?? null;
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
