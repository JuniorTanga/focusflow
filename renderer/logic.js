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

export function createTask({ title, whenWhere = null, priority = 'medium', timebox = null, due = 'today', completedAt = null, groupId = null, now = new Date() }) {
  return {
    id: newId(),
    title,
    whenWhere,
    priority,
    timebox,
    due,
    groupId,
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

export function partitionTasks(tasks, now = new Date()) {
  const incomplete = sortTasks(tasks.filter((t) => !t.completedAt));
  const doneToday = tasks
    .filter((t) => t.completedAt && isSameDay(new Date(t.completedAt), now))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  return { next: incomplete[0] ?? null, backlog: incomplete.slice(1), doneToday };
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

const GREETINGS = {
  morning: {
    none: [
      { label: 'Good morning.', line: 'No pressure — just one small thing when you are ready.' },
      { label: 'Morning.', line: 'A slow start still counts as a start.' },
      { label: 'Good morning.', line: 'What is the one thing that would make today feel complete?' }
    ],
    one: [
      { label: 'Good morning.', line: 'One thing done already. Gently onward.' },
      { label: 'Morning.', line: 'A first step is behind you. Nice work.' }
    ],
    many: [
      { label: 'Good morning.', line: 'You have already done N things today. That is a real beginning.' },
      { label: 'Morning.', line: 'N down. The day has shape to it now.' }
    ]
  },
  afternoon: {
    none: [
      { label: 'Good afternoon.', line: 'The day is not over. One small thing is enough.' },
      { label: 'Afternoon.', line: 'A short task now beats a long one later.' }
    ],
    one: [
      { label: 'Good afternoon.', line: 'One done today. The next is closer than it feels.' },
      { label: 'Afternoon.', line: 'You started. That is half the work.' }
    ],
    many: [
      { label: 'Good afternoon.', line: 'N things done today. Keep going at your own pace.' },
      { label: 'Afternoon.', line: 'N finished already. Plenty of daylight left, no rush.' }
    ]
  },
  evening: {
    none: [
      { label: 'Good evening.', line: 'Evenings suit the easy tasks. Pick something tiny.' },
      { label: 'Evening.', line: 'One small thing, then rest easy.' }
    ],
    one: [
      { label: 'Good evening.', line: 'One thing done today — something to build on.' },
      { label: 'Evening.', line: 'You did one today. That counts.' }
    ],
    many: [
      { label: 'Good evening.', line: 'N things done today. Notice how that looks.' },
      { label: 'Evening.', line: 'N finished. A good place to stop.' }
    ]
  },
  night: {
    none: [
      { label: 'It is late.', line: 'Rest matters. If anything, keep it tiny and kind.' },
      { label: 'Late again.', line: 'Nothing done yet is fine. Tomorrow has room.' }
    ],
    one: [
      { label: 'It is late.', line: 'You got one in today. That is enough to count.' },
      { label: 'Late.', line: 'One done. Let the day close.' }
    ],
    many: [
      { label: 'It is late.', line: 'N things done today. Time to let the day close.' },
      { label: 'Late.', line: 'N finished. Rest well.' }
    ]
  }
};

export function greetingFor(now = new Date(), doneCount = 0, name = null) {
  const bucket = timeBucket(now);
  const pool = GREETINGS[bucket][stateClass(doneCount)];
  const pick = pool[dayNumber(now) % pool.length];
  const label = name ? pick.label.replace(/\.$/, '') + `, ${name}.` : pick.label;
  return { bucket, label, line: pick.line };
}

export const PRINCIPLES = [
  { name: 'Hick\u2019s Law', line: 'Fewer choices, faster action.', why: 'Every visible option is a decision. One task on screen removes the cost of choosing.' },
  { name: 'The Zeigarnik Effect', line: 'Unfinished tasks linger.', why: 'Open loops nag at the mind. Closing them — even in tiny steps — frees your attention.' },
  { name: 'Implementation Intentions', line: 'Plan the when and where.', why: 'Tasks with a time and place are two to three times more likely to get done.' },
  { name: 'Friction Design', line: 'Make delay honest.', why: 'When postponing costs a little effort, you postpone for real reasons, not impulses.' },
  { name: 'Micro-Steps', line: 'Shrink the task until it is easy.', why: 'Vague, large tasks trigger a threat response; tiny steps slip past it.' },
  { name: 'Attention Residue', line: 'One focus at a time.', why: 'Switching tasks leaves mental residue. A single focus protects your attention.' },
  { name: 'The Fresh Start', line: 'Each day is a clean page.', why: 'A broken streak is not a failure. Today starts fresh, without shame.' },
  { name: 'Small Wins', line: 'Mark the finish.', why: 'Visible progress releases the tension of unfinished work and builds momentum.' },
  { name: 'Visual Calm', line: 'Softer screens, clearer mind.', why: 'A calm interface lowers anxiety — no harsh colors, no visual reprimands.' },
  { name: 'Energy Matching', line: 'Do the right task at the right time.', why: 'Matching a task to your current energy makes starting feel possible.' }
];

export function principleOfDay(now = new Date()) {
  return PRINCIPLES[dayNumber(now) % PRINCIPLES.length];
}
