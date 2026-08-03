import {
  createTask,
  partitionTasks,
  pruneOldCompletions,
  validateReason,
  resolveDueForReschedule,
  greetingFor,
  principleOfDay,
  timeBucket
} from './logic.js';
import { icon } from './icons.js';

const STORAGE_KEY = 'focusflow.v1';
const $ = (id) => document.getElementById(id);

let tasks = [];
let themePreference = null;
let backlogOpen = false;
let modalTaskId = null;
let modalDue = 'today';
let composing = { priority: 'medium', timebox: 30 };

const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
const DUE_LABEL = { today: 'Today', tomorrow: 'Tomorrow', week: 'This week' };
const BUCKET_ICON = { morning: 'sun', afternoon: 'sun', evening: 'moon', night: 'moon' };
const BUCKET_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };
const CELEBRATION_COLORS = ['var(--accent)', 'var(--warm)', 'var(--accent-strong)'];

/* ---------------- State ---------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      theme: data.theme === 'light' || data.theme === 'dark' ? data.theme : null
    };
  } catch {
    return null;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, theme: themePreference }));
}

/* ---------------- Theme ---------------- */

function resolvedTheme() {
  if (themePreference) return themePreference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme() {
  document.body.dataset.theme = resolvedTheme();
  const btn = $('themeToggle');
  if (btn) btn.innerHTML = resolvedTheme() === 'dark' ? icon('sun') : icon('moon');
}

function toggleTheme() {
  themePreference = resolvedTheme() === 'dark' ? 'light' : 'dark';
  applyTheme();
  saveState();
}

/* ---------------- Helpers ---------------- */

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function timeLabel(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function priorityTag(task) {
  const p = task.priority in PRIORITY_LABEL ? task.priority : 'medium';
  return `<span class="tag ${esc(p)}">${icon('zap')}${PRIORITY_LABEL[p]}</span>`;
}

function dueTag(task) {
  const d = task.due in DUE_LABEL ? task.due : 'today';
  return `<span class="tag ${esc(d)}">${icon('calendar')}${DUE_LABEL[d]}</span>`;
}

function timeboxTag(task) {
  if (!task.timebox) return '';
  return `<span class="tag">${icon('clock')}${task.timebox} min</span>`;
}

/* ---------------- Render ---------------- */

function renderGreeting(doneCount) {
  const now = new Date();
  const g = greetingFor(now, doneCount);
  const bucket = timeBucket(now);
  $('greeting').innerHTML = `
    <div class="greeting-eyebrow">
      <span>${icon(BUCKET_ICON[bucket])}${BUCKET_LABEL[bucket]}</span>
      <button class="icon-btn theme-toggle" id="themeToggle" title="Toggle theme" aria-label="Toggle theme"></button>
    </div>
    <h1 class="greeting-label">${esc(g.label)}</h1>
    <p class="greeting-line">${esc(g.line)}</p>`;
  $('themeToggle').addEventListener('click', toggleTheme);
  applyTheme();
}

function renderHero(task) {
  const label = $('heroLabel');
  label.innerHTML = `${icon('target')}Focus on this`;

  if (!task) {
    $('hero').innerHTML = `
      <div class="hero-empty">
        <div class="hero-empty-icon">${icon('checkCircle')}</div>
        <div class="hero-empty-title">Nothing here yet.</div>
        <p>Add your first task below. One thing at a time.</p>
      </div>`;
    return;
  }

  $('hero').innerHTML = `
    <div class="hero-card" id="heroCard">
      <div class="hero-top">
        <div class="hero-tags">${priorityTag(task)}${dueTag(task)}${timeboxTag(task)}</div>
        <div class="hero-actions-top">
          <button class="icon-btn" id="heroPostpone" title="Postpone" aria-label="Postpone">${icon('refresh')}</button>
          <button class="icon-btn danger" id="heroDelete" title="Delete" aria-label="Delete">${icon('trash')}</button>
        </div>
      </div>
      <h2 class="hero-title">${esc(task.title)}</h2>
      ${task.whenWhere ? `<p class="hero-context">${icon('mapPin')}${esc(task.whenWhere)}</p>` : ''}
      <div class="hero-actions">
        <button class="btn btn-primary" id="heroDone">${icon('check')}Done</button>
        <button class="btn btn-ghost" id="heroPostponeBtn">${icon('refresh')}Postpone</button>
      </div>
    </div>`;

  $('heroDone').addEventListener('click', () => completeTask(task.id));
  $('heroPostpone').addEventListener('click', () => openReschedule(task.id));
  $('heroPostponeBtn').addEventListener('click', () => openReschedule(task.id));
  $('heroDelete').addEventListener('click', () => deleteTask(task.id));
}

function renderDone(doneToday) {
  const section = $('doneSection');
  if (doneToday.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  $('doneLabel').innerHTML = `${icon('check')}Done today <span class="done-count">· ${doneToday.length}</span>`;
  $('doneList').innerHTML = doneToday.map((t) => `
    <div class="done-item">
      ${icon('check')}
      <span class="done-title">${esc(t.title)}</span>
      <span class="done-time">${esc(timeLabel(t.completedAt))}</span>
    </div>`).join('');
}

function renderBacklog(backlog) {
  const section = $('backlogSection');
  if (backlog.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const count = backlog.length;
  $('backlogTitle').innerHTML = `${icon('list')}Backlog <span class="done-count">· ${count}</span>`;
  $('backlogChevron').innerHTML = icon('chevronDown');

  const toggle = $('backlogToggle');
  toggle.setAttribute('aria-expanded', String(backlogOpen));
  $('backlogList').classList.toggle('open', backlogOpen);

  $('backlogList').innerHTML = backlog.map((t) => `
    <div class="backlog-item" data-id="${t.id}">
      <span class="backlog-title">${esc(t.title)}</span>
      <span class="backlog-meta">
        <span>${icon('calendar')}${DUE_LABEL[t.due] ?? 'Today'}</span>
        ${t.timebox ? `<span>${icon('clock')}${t.timebox} min</span>` : ''}
      </span>
      <button class="icon-btn" data-del="${t.id}" title="Delete" aria-label="Delete">${icon('trash')}</button>
    </div>`).join('');

  $('backlogList').querySelectorAll('.backlog-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-del]')) return;
      promoteTask(el.dataset.id);
    });
  });
  $('backlogList').querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.del));
  });
}

function renderPrinciple() {
  const p = principleOfDay(new Date());
  $('principle').innerHTML = `
    <div class="principle-label">${icon('zap')}Principle of the day</div>
    <div class="principle-name">${esc(p.name)}</div>
    <div class="principle-line">${esc(p.line)}</div>
    <p class="principle-why">${esc(p.why)}</p>`;
}

function renderAll() {
  const { next, backlog, doneToday } = partitionTasks(tasks, new Date());
  renderGreeting(doneToday.length);
  renderHero(next);
  renderDone(doneToday);
  renderBacklog(backlog);
  renderPrinciple();
}

/* ---------------- Backlog ---------------- */

function setupBacklog() {
  $('backlogToggle').addEventListener('click', () => {
    backlogOpen = !backlogOpen;
    renderAll();
  });
}

/* ---------------- Actions ---------------- */

function addTaskFromComposer() {
  const input = $('taskTitle');
  const title = input.value.trim();
  if (!title) {
    input.focus();
    return;
  }
  tasks.push(createTask({
    title,
    priority: composing.priority,
    timebox: composing.timebox,
    whenWhere: $('taskContext').value.trim() || null
  }));
  input.value = '';
  $('taskContext').value = '';
  saveState();
  renderAll();
  input.focus();
}

function completeTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.completedAt = new Date().toISOString();
  saveState();
  renderAll();
  celebrate();
}

function promoteTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.due = 'today';
  task.priority = 'high';
  saveState();
  renderAll();
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveState();
  renderAll();
}

/* ---------------- Reschedule (friction) ---------------- */

const OPTIONS = [
  { value: 'today', label: 'Later today', icon: 'clock' },
  { value: 'tomorrow', label: 'Tomorrow', icon: 'calendar' },
  { value: 'week', label: 'This week', icon: 'list' }
];

function openReschedule(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  modalTaskId = id;
  modalDue = resolveDueForReschedule(task.due);
  $('rescheduleOptions').innerHTML = OPTIONS.map((o) => `
    <button class="option" data-value="${o.value}" aria-pressed="${modalDue === o.value}">
      ${icon(o.icon)}${o.label}
    </button>`).join('');

  $('rescheduleOptions').querySelectorAll('.option').forEach((btn) => {
    btn.addEventListener('click', () => {
      modalDue = btn.dataset.value;
      $('rescheduleOptions').querySelectorAll('.option').forEach((b) =>
        b.setAttribute('aria-pressed', String(b === btn)));
    });
  });

  const reason = $('reasonInput');
  reason.value = '';
  $('reasonHint').textContent = 'A short reason first — this keeps delays honest.';
  $('modalConfirm').disabled = true;
  $('rescheduleModal').classList.add('active');
  reason.focus();
}

function closeReschedule() {
  $('rescheduleModal').classList.remove('active');
  modalTaskId = null;
}

function confirmReschedule() {
  const task = tasks.find((t) => t.id === modalTaskId);
  if (!task || !validateReason($('reasonInput').value)) return;
  task.due = modalDue;
  closeReschedule();
  saveState();
  renderAll();
}

/* ---------------- Celebration ---------------- */

function celebrate() {
  const heroCard = $('heroCard');
  const container = $('celebration');
  const { innerWidth: w, innerHeight: h } = window;
  const cx = heroCard ? heroCard.getBoundingClientRect().left + heroCard.offsetWidth / 2 : w / 2;
  const cy = heroCard ? heroCard.getBoundingClientRect().top + 40 : h / 2;

  const ring = document.createElement('div');
  ring.className = 'celebration-ring';
  ring.style.left = `${cx}px`;
  ring.style.top = `${cy}px`;
  container.appendChild(ring);

  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.background = CELEBRATION_COLORS[i % CELEBRATION_COLORS.length];
    const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
    const dist = 60 + Math.random() * 70;
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist - 40}px`);
    p.style.animationDelay = `${Math.random() * 0.08}s`;
    container.appendChild(p);
  }
  setTimeout(() => { container.innerHTML = ''; }, 1000);
}

/* ---------------- Titlebar ---------------- */

function setupTitlebar() {
  $('titlebarBrand').innerHTML = `${icon('logo')}<span>FocusFlow</span>`;
  $('btnMin').innerHTML = icon('minus');
  $('btnMax').innerHTML = icon('square');
  $('btnClose').innerHTML = icon('x');

  $('btnMin').addEventListener('click', () => window.appWindow?.minimize());
  $('btnMax').addEventListener('click', () => window.appWindow?.toggleMaximize());
  $('btnClose').addEventListener('click', () => window.appWindow?.close());

  if (window.appWindow?.onMaximizeStateChange) {
    window.appWindow.onMaximizeStateChange((maximized) => {
      $('btnMax').innerHTML = maximized ? icon('copy') : icon('square');
      $('btnMax').title = maximized ? 'Restore' : 'Maximize';
    });
  }
}

/* ---------------- Composer ---------------- */

function setupComposer() {
  $('composerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addTaskFromComposer();
  });

  const detailsToggle = $('detailsToggle');
  detailsToggle.innerHTML = icon('chevronUp');
  $('submitBtn').innerHTML = icon('plus');
  detailsToggle.addEventListener('click', () => {
    const open = $('composerDetails').classList.toggle('open');
    detailsToggle.classList.toggle('open', open);
    detailsToggle.setAttribute('aria-expanded', String(open));
  });

  const segs = [
    ['prioritySeg', (v) => { composing.priority = v; }, 'medium'],
    ['timeboxSeg', (v) => { composing.timebox = parseInt(v, 10); }, '30']
  ];
  segs.forEach(([id, setter, initial]) => {
    $(id).querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setter(btn.dataset.value);
        $(id).querySelectorAll('.seg-btn').forEach((b) =>
          b.setAttribute('aria-pressed', String(b === btn)));
      });
    });
  });
}

/* ---------------- Modal events ---------------- */

function setupModal() {
  $('modalCancel').addEventListener('click', closeReschedule);
  $('modalConfirm').addEventListener('click', confirmReschedule);
  $('reasonInput').addEventListener('input', () => {
    const valid = validateReason($('reasonInput').value);
    $('modalConfirm').disabled = !valid;
    $('reasonHint').textContent = valid
      ? 'Good. Honest delays are allowed.'
      : 'A short reason first — this keeps delays honest.';
  });
  $('rescheduleModal').addEventListener('click', (e) => {
    if (e.target === $('rescheduleModal')) closeReschedule();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('rescheduleModal').classList.contains('active')) closeReschedule();
  });
}

/* ---------------- Init ---------------- */

function init() {
  const saved = loadState();
  tasks = saved ? saved.tasks : [];
  themePreference = saved ? saved.theme : null;

  const now = new Date();
  const pruned = pruneOldCompletions(tasks, now);
  if (pruned.length !== tasks.length) {
    tasks = pruned;
    saveState();
  }

  setupTitlebar();
  setupComposer();
  setupBacklog();
  setupModal();
  renderAll();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!themePreference) applyTheme();
  });

  setInterval(() => {
    const { doneToday } = partitionTasks(tasks, new Date());
    renderGreeting(doneToday.length);
  }, 60_000);
}

init();
