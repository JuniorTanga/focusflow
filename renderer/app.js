import {
  createTask,
  createGroup,
  partitionTasks,
  pruneOldCompletions,
  validateReason,
  resolveDueForReschedule,
  greetingFor,
  principleOfDay,
  timeBucket
} from './logic.js';
import { icon } from './icons.js';
import { t, setLang, getLang, LANGS } from './i18n.js';

const STORAGE_KEY = 'focusflow.v1';
const $ = (id) => document.getElementById(id);

let tasks = [];
let groups = [];
let themePreference = null;
let userName = '';
let langPreference = 'en';
let currentView = 'home';
let activeGroupId = null;
let modalTaskId = null;
let modalDue = 'today';
let composing = { priority: 'medium', timebox: 30, groupId: '' };

const BUCKET_ICON = { morning: 'sun', afternoon: 'sun', evening: 'moon', night: 'moon' };
const CELEBRATION_COLORS = ['var(--accent)', 'var(--warm)', 'var(--accent-strong)'];
const GROUP_COLORS = ['#bd9259', '#6b8e74', '#8a7ba8', '#a8696b', '#5f8a94', '#9a7b4f'];

/* ---------------- State ---------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      groups: Array.isArray(data.groups) ? data.groups : [],
      theme: data.theme === 'light' || data.theme === 'dark' ? data.theme : null,
      userName: typeof data.userName === 'string' ? data.userName : '',
      lang: LANGS.includes(data.lang) ? data.lang : 'en'
    };
  } catch {
    return null;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, groups, theme: themePreference, userName, lang: langPreference }));
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

function setTheme(value) {
  themePreference = value === 'light' || value === 'dark' ? value : null;
  applyTheme();
  saveState();
  renderSettingsTheme();
}

function toggleTheme() {
  setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
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

function groupById(id) {
  return groups.find((g) => g.id === id) ?? null;
}

function groupOf(task) {
  return task.groupId ? groupById(task.groupId) : null;
}

function priorityTag(task) {
  const p = task.priority in { high: 1, medium: 1, low: 1 } ? task.priority : 'medium';
  return `<span class="tag ${esc(p)}">${icon('zap')}${esc(t('priority.' + p))}</span>`;
}

function dueTag(task) {
  const d = task.due in { today: 1, tomorrow: 1, week: 1 } ? task.due : 'today';
  return `<span class="tag ${esc(d)}">${icon('calendar')}${esc(t('due.' + d))}</span>`;
}

function timeboxTag(task) {
  if (!task.timebox) return '';
  return `<span class="tag">${icon('clock')}${task.timebox} min</span>`;
}

/* ---------------- Navigation ---------------- */

function setView(view) {
  currentView = view;
  ['home', 'backlog', 'settings'].forEach((v) => {
    $('nav' + v.charAt(0).toUpperCase() + v.slice(1)).setAttribute('aria-pressed', String(v === view));
    $('view-' + v).hidden = v !== view;
  });
  renderAll();
}

/* ---------------- Sidebar groups ---------------- */

function renderGroupList() {
  const active = activeGroupId;
  const allCount = tasks.filter((t) => !t.completedAt).length;
  const ungroupedCount = tasks.filter((t) => !t.completedAt && !t.groupId).length;

  let html = `
    <button class="group-item" data-gid="" aria-pressed="${active === null}">
      ${icon('inbox')}<span>${esc(t('group.all'))}</span><span class="group-count">${allCount}</span>
    </button>
    <button class="group-item" data-gid="ungrouped" aria-pressed="${active === 'ungrouped'}">
      ${icon('folder')}<span>${esc(t('group.ungrouped'))}</span><span class="group-count">${ungroupedCount}</span>
    </button>`;

  groups.forEach((g) => {
    const count = tasks.filter((t) => !t.completedAt && t.groupId === g.id).length;
    html += `
    <button class="group-item" data-gid="${esc(g.id)}" data-color="${esc(g.color)}" aria-pressed="${active === g.id}">
      <span class="group-dot"></span><span>${esc(g.name)}</span><span class="group-count">${count}</span>
    </button>`;
  });

  $('groupList').innerHTML = html;
  $('groupList').querySelectorAll('[data-color]').forEach((el) => {
    el.querySelector('.group-dot').style.background = el.dataset.color;
  });
  $('groupList').querySelectorAll('.group-item').forEach((el) => {
    el.addEventListener('click', () => {
      activeGroupId = el.dataset.gid === '' ? null : el.dataset.gid;
      renderGroupList();
      if (currentView !== 'backlog') setView('backlog');
      else renderAll();
    });
  });
}

function renderComposerGroups() {
  const select = $('taskGroup');
  const keep = composing.groupId && groups.some((g) => g.id === composing.groupId) ? composing.groupId : '';
  composing.groupId = keep;
  select.innerHTML = `<option value="">${esc(t('group.none'))}</option>` +
    groups.map((g) => `<option value="${esc(g.id)}" ${g.id === composing.groupId ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
  select.setAttribute('aria-label', t('composer.group'));
}

function addGroup() {
  const input = $('groupInput');
  const name = input.value.trim();
  if (!name) return;
  groups.push(createGroup({ name, color: GROUP_COLORS[groups.length % GROUP_COLORS.length] }));
  input.value = '';
  $('groupForm').hidden = true;
  saveState();
  renderGroupList();
  renderComposerGroups();
  renderAll();
}

function setupGroupAdd() {
  $('groupAdd').addEventListener('click', () => {
    const wrap = $('groupForm');
    wrap.hidden = !wrap.hidden;
    if (!wrap.hidden) $('groupInput').focus();
  });
  $('groupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addGroup();
  });
}

/* ---------------- Render ---------------- */

function renderGreeting(doneCount) {
  const now = new Date();
  const g = greetingFor(now, doneCount, userName.trim() || null, getLang());
  const bucket = timeBucket(now);
  $('greeting').innerHTML = `
    <div class="greeting-eyebrow">
      <span>${icon(BUCKET_ICON[bucket])}${esc(t('bucket.' + bucket))}</span>
    </div>
    <h1 class="greeting-label">${esc(g.label)}</h1>
    <p class="greeting-line">${esc(g.line)}</p>`;
}

function renderHero(task) {
  const label = $('heroLabel');
  label.innerHTML = `${icon('target')}${esc(t('hero.focus'))}`;

  if (!task) {
    $('hero').innerHTML = `
      <div class="hero-empty">
        <div class="hero-empty-icon">${icon('checkCircle')}</div>
        <div class="hero-empty-title">${esc(t('hero.emptyTitle'))}</div>
        <p>${esc(t('hero.emptyLine'))}</p>
      </div>`;
    return;
  }

  const g = groupOf(task);
  $('hero').innerHTML = `
    <div class="hero-card" id="heroCard">
      <div class="hero-top">
        <div class="hero-tags">${priorityTag(task)}${dueTag(task)}${timeboxTag(task)}${g ? `<span class="tag">${icon('folder')}${esc(g.name)}</span>` : ''}</div>
        <div class="hero-actions-top">
          <button class="icon-btn" id="heroPostpone" title="${esc(t('action.postpone'))}" aria-label="${esc(t('action.postpone'))}">${icon('refresh')}</button>
          <button class="icon-btn danger" id="heroDelete" title="${esc(t('action.delete'))}" aria-label="${esc(t('action.delete'))}">${icon('trash')}</button>
        </div>
      </div>
      <h2 class="hero-title">${esc(task.title)}</h2>
      ${task.whenWhere ? `<p class="hero-context">${icon('mapPin')}${esc(task.whenWhere)}</p>` : ''}
      <div class="hero-actions">
        <button class="btn btn-primary" id="heroDone">${icon('check')}${esc(t('hero.done'))}</button>
        <button class="btn btn-ghost" id="heroPostponeBtn">${icon('refresh')}${esc(t('hero.postpone'))}</button>
      </div>
    </div>`;

  $('heroDone').addEventListener('click', () => completeTask(task.id));
  $('heroPostpone').addEventListener('click', () => openReschedule(task.id));
  $('heroPostponeBtn').addEventListener('click', () => openReschedule(task.id));
  $('heroDelete').addEventListener('click', () => deleteTask(task.id));
}

function groupMoveOptions(task) {
  const options = [{ id: '', name: t('group.none') }, ...groups.map((g) => ({ id: g.id, name: g.name }))];
  return `<select class="backlog-group-select" data-move="${esc(task.id)}" aria-label="${esc(t('group.moveTo'))}">
    ${options.map((o) => `<option value="${esc(o.id)}" ${o.id === task.groupId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
  </select>`;
}

function renderBacklog() {
  const { backlog, doneToday } = partitionTasks(tasks, new Date());

  const filterLabel = activeGroupId === null
    ? t('backlog.all')
    : activeGroupId === 'ungrouped'
      ? t('group.ungrouped')
      : (groupById(activeGroupId)?.name ?? t('backlog.all'));
  $('backlogFilterLabel').textContent = filterLabel;

  const filtered = activeGroupId === 'ungrouped'
    ? backlog.filter((t) => !t.groupId)
    : activeGroupId
      ? backlog.filter((t) => t.groupId === activeGroupId)
      : backlog;

  $('backlogLabel').innerHTML = `${icon('list')}${esc(t('backlog.title'))} <span class="done-count">· ${filtered.length}</span>`;
  $('backlogEmptyIcon').innerHTML = icon('inbox');
  $('backlogEmpty').hidden = filtered.length > 0;
  $('backlogList').innerHTML = filtered.map((item) => {
    const g = groupOf(item);
    return `
    <div class="backlog-item" data-id="${item.id}">
      <span class="backlog-title">${esc(item.title)}</span>
      ${g ? `<span class="backlog-group"><span class="group-dot" data-dot="${esc(g.color)}"></span>${esc(g.name)}</span>` : ''}
      <span class="backlog-meta">
        <span>${icon('calendar')}${esc(t('due.' + (item.due in { today: 1, tomorrow: 1, week: 1 } ? item.due : 'today')))}</span>
        ${item.timebox ? `<span>${icon('clock')}${item.timebox} min</span>` : ''}
      </span>
      ${groupMoveOptions(item)}
      <button class="icon-btn" data-del="${item.id}" title="${esc(t('action.delete'))}" aria-label="${esc(t('action.delete'))}">${icon('trash')}</button>
    </div>`;
  }).join('');

  $('backlogList').querySelectorAll('[data-dot]').forEach((el) => {
    el.style.background = el.dataset.dot;
  });

  $('backlogList').querySelectorAll('.backlog-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-del]') || e.target.closest('.backlog-group-select')) return;
      promoteTask(el.dataset.id);
    });
  });
  $('backlogList').querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.del));
  });
  $('backlogList').querySelectorAll('[data-move]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const task = tasks.find((t) => t.id === sel.dataset.move);
      if (!task) return;
      task.groupId = sel.value || null;
      saveState();
      renderBacklog();
      renderGroupList();
      renderHero(partitionTasks(tasks, new Date()).next);
    });
  });

  $('doneLabel').innerHTML = doneToday.length === 0
    ? `${icon('check')}${esc(t('done.today'))}`
    : `${icon('check')}${esc(t('done.today'))} <span class="done-count">· ${doneToday.length}</span>`;
  $('doneList').innerHTML = doneToday.map((item) => `
    <div class="done-item">
      ${icon('check')}
      <span class="done-title">${esc(item.title)}</span>
      <span class="done-time">${esc(timeLabel(item.completedAt))}</span>
    </div>`).join('');
}

function renderSettingsTheme() {
  ['light', 'dark', 'system'].forEach((v) => {
    const btn = $('settingsThemeSeg').querySelector(`[data-value="${v}"]`);
    btn?.setAttribute('aria-pressed', String((themePreference ?? 'system') === v));
  });
}

function renderSettingsLanguage() {
  LANGS.forEach((v) => {
    const btn = $('settingsLangSeg').querySelector(`[data-value="${v}"]`);
    btn?.setAttribute('aria-pressed', String(langPreference === v));
  });
}

function renderSettings() {
  $('userNameInput').value = userName;
  renderSettingsTheme();
  renderSettingsLanguage();
}

function renderPrinciple() {
  const p = principleOfDay(new Date(), getLang());
  $('principle').innerHTML = `
    <div class="principle-label">${icon('zap')}${esc(t('principle.label'))}</div>
    <div class="principle-name">${esc(p.name)}</div>
    <div class="principle-line">${esc(p.line)}</div>
    <p class="principle-why">${esc(p.why)}</p>`;
}

function renderAll() {
  const { next, doneToday } = partitionTasks(tasks, new Date());
  renderGroupList();
  renderComposerGroups();
  if (currentView === 'home') {
    renderGreeting(doneToday.length);
    renderHero(next);
  } else if (currentView === 'backlog') {
    renderBacklog();
  } else {
    renderSettings();
  }
  renderPrinciple();
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
    whenWhere: $('taskContext').value.trim() || null,
    groupId: composing.groupId || null
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
  { value: 'today', labelKey: 'modal.laterToday', icon: 'clock' },
  { value: 'tomorrow', labelKey: 'modal.tomorrow', icon: 'calendar' },
  { value: 'week', labelKey: 'modal.week', icon: 'list' }
];

function openReschedule(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  modalTaskId = id;
  modalDue = resolveDueForReschedule(task.due);
  $('rescheduleOptions').innerHTML = OPTIONS.map((o) => `
    <button class="option" data-value="${o.value}" aria-pressed="${modalDue === o.value}">
      ${icon(o.icon)}${esc(t(o.labelKey))}
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
  $('reasonHint').textContent = t('modal.reasonHint');
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
      $('btnMax').title = t(maximized ? 'titlebar.restore' : 'titlebar.maximize');
    });
  }
}

/* ---------------- Composer ---------------- */

function setComposerDetails(open) {
  $('composerDetails').classList.toggle('open', open);
  $('detailsToggle').classList.toggle('open', open);
  $('detailsToggle').setAttribute('aria-expanded', String(open));
}

function setupComposer() {
  $('composerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addTaskFromComposer();
  });

  const detailsToggle = $('detailsToggle');
  detailsToggle.innerHTML = icon('chevronUp');
  $('submitBtn').innerHTML = icon('plus');
  detailsToggle.addEventListener('click', () => {
    setComposerDetails(!$('composerDetails').classList.contains('open'));
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

  $('taskGroup').addEventListener('change', () => {
    composing.groupId = $('taskGroup').value;
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
      ? t('modal.reasonGood')
      : t('modal.reasonHint');
  });
  $('rescheduleModal').addEventListener('click', (e) => {
    if (e.target === $('rescheduleModal')) closeReschedule();
  });
}

/* ---------------- Shortcuts ---------------- */

const SHORTCUTS = [
  { key: '/', mod: false, action: 'quickAdd' },
  { key: 'n', mod: true, action: 'newTask' },
  { key: '1', mod: true, action: 'view', view: 'home' },
  { key: '2', mod: true, action: 'view', view: 'backlog' },
  { key: '3', mod: true, action: 'view', view: 'settings' },
  { key: 'k', mod: true, action: 'focusTask' }
];

function shortcutTargets(action, view) {
  if (action === 'view') return setView(view);
  if (action === 'quickAdd') {
    if (currentView !== 'home') setView('home');
    setComposerDetails(!$('composerDetails').classList.contains('open'));
    $('taskTitle').focus();
    return;
  }
  if (action === 'newTask') {
    if (currentView !== 'home') setView('home');
    if (!$('composerDetails').classList.contains('open')) setComposerDetails(true);
    $('taskTitle').focus();
    return;
  }
  if (action === 'focusTask') {
    if (currentView !== 'home') setView('home');
    const input = $('taskTitle');
    input.focus();
    input.select();
  }
}

function setupShortcuts() {
  document.addEventListener('keydown', (e) => {
    const target = e.target;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;

    if (e.key === 'Escape') {
      if ($('rescheduleModal').classList.contains('active')) closeReschedule();
      else if (!$('groupForm').hidden) {
        $('groupForm').hidden = true;
        $('groupInput').value = '';
      }
      return;
    }

    if (e.key === 'Tab' && currentView === 'home' && target === $('taskTitle')) {
      e.preventDefault();
      setComposerDetails(!$('composerDetails').classList.contains('open'));
      return;
    }

    if (typing && (e.metaKey || e.ctrlKey)) {
      if (e.key.toLowerCase() === 'n') e.preventDefault();
    } else if (typing) {
      return;
    }

    for (const s of SHORTCUTS) {
      const mod = e.metaKey || e.ctrlKey;
      if (s.mod !== mod) continue;
      if (e.key.toLowerCase() !== s.key) continue;
      if (s.action === 'view' && currentView === s.view) continue;
      e.preventDefault();
      shortcutTargets(s.action, s.view);
      break;
    }
  });
}

/* ---------------- Settings ---------------- */

function setupSettings() {
  $('themeToggle').addEventListener('click', toggleTheme);
  $('settingsThemeSeg').querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => setTheme(btn.dataset.value));
  });
  $('userNameInput').addEventListener('input', () => {
    userName = $('userNameInput').value;
    saveState();
    renderGroupList();
  });
  $('clearDataBtn').textContent = t('settings.clear');
  $('clearDataBtn').addEventListener('click', () => {
    if (!confirm(t('settings.clearConfirm'))) return;
    tasks = [];
    groups = [];
    userName = '';
    activeGroupId = null;
    currentView = 'home';
    saveState();
    applyTheme();
    setView('home');
    renderAll();
  });
}

/* ---------------- Localization ---------------- */

const SHORTCUT_LIST = [
  ['/', 'shortcut.quickAdd'],
  ['Tab', 'shortcut.openDetails'],
  ['Ctrl+N', 'shortcut.newTask'],
  ['Ctrl+K', 'shortcut.focusTask'],
  ['Ctrl+1', 'shortcut.home'],
  ['Ctrl+2', 'shortcut.backlog'],
  ['Ctrl+3', 'shortcut.settings'],
  ['Esc', 'shortcut.close']
];

function applyStrings() {
  document.documentElement.lang = langPreference;

  $('navHome').innerHTML = `${icon('home')}${esc(t('nav.home'))}`;
  $('navBacklog').innerHTML = `${icon('list')}${esc(t('nav.backlog'))}`;
  $('navSettings').innerHTML = `${icon('settings')}${esc(t('nav.settings'))}`;
  $('groupAdd').innerHTML = icon('folderPlus');

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const label = t(el.dataset.i18nTitle);
    el.title = label;
    el.setAttribute('aria-label', label);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });

  document.querySelectorAll('#prioritySeg .seg-btn').forEach((btn) => {
    btn.textContent = t('priority.' + btn.dataset.value);
  });
  document.querySelectorAll('#timeboxSeg .seg-btn').forEach((btn) => {
    btn.textContent = `${btn.dataset.value} min`;
  });
  document.querySelectorAll('#settingsThemeSeg .seg-btn').forEach((btn) => {
    btn.textContent = t('theme.' + btn.dataset.value);
  });
  document.querySelectorAll('#settingsLangSeg .seg-btn').forEach((btn) => {
    btn.textContent = t('lang.' + btn.dataset.value);
  });

  $('shortcutList').innerHTML = SHORTCUT_LIST.map(([kbd, key]) =>
    `<li><span>${esc(t(key))}</span><kbd>${kbd}</kbd></li>`).join('');
}

function setLangPref(value) {
  langPreference = LANGS.includes(value) ? value : 'en';
  setLang(langPreference);
  saveState();
  applyStrings();
  renderSettingsLanguage();
  renderAll();
}

/* ---------------- Init ---------------- */

function init() {
  const saved = loadState();
  tasks = saved ? saved.tasks : [];
  groups = saved ? saved.groups : [];
  themePreference = saved ? saved.theme : null;
  userName = saved ? saved.userName : '';
  langPreference = saved
    ? saved.lang
    : (navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en');
  setLang(langPreference);

  const now = new Date();
  const pruned = pruneOldCompletions(tasks, now);
  if (pruned.length !== tasks.length) {
    tasks = pruned;
    saveState();
  }

  setupTitlebar();
  setupComposer();
  setupGroupAdd();
  setupModal();
  setupSettings();
  setupShortcuts();

  $('settingsLangSeg').querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => setLangPref(btn.dataset.value));
  });

  applyStrings();

  setView('home');
  renderAll();

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!themePreference) {
      applyTheme();
      renderSettingsTheme();
    }
  });

  setInterval(() => {
    if (currentView !== 'home') return;
    const { doneToday } = partitionTasks(tasks, new Date());
    renderGreeting(doneToday.length);
  }, 60_000);
}

init();
