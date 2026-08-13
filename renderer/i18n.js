export const LANGS = ['en', 'fr'];

let lang = 'en';

export function setLang(value) {
  if (LANGS.includes(value)) lang = value;
}

export function getLang() {
  return lang;
}

export function t(key) {
  const dict = STRINGS[lang] ?? STRINGS.en;
  return dict[key] !== undefined ? dict[key] : STRINGS.en[key] ?? key;
}

export const STRINGS = {
  en: {
    'nav.home': 'Home',
    'nav.backlog': 'Backlog',
    'nav.settings': 'Settings',
    'groups.title': 'Groups',
    'group.new': 'New group',
    'group.placeholder': 'Group name',
    'group.all': 'All',
    'group.ungrouped': 'Ungrouped',
    'group.none': 'No group',
    'group.moveTo': 'Move to group',

    'composer.placeholder': 'What needs to be done?',
    'composer.details': 'Details',
    'composer.addTask': 'Add task',
    'composer.priority': 'Priority',
    'composer.timebox': 'Time-box',
    'composer.whenWhere': 'When & where',
    'composer.contextPlaceholder': 'e.g. At my desk, after lunch',
    'composer.guessHint': 'Guessed due: {due}',
    'composer.group': 'Group',
    'priority.high': 'High',
    'priority.medium': 'Medium',
    'priority.low': 'Low',

    'hero.focus': 'Focus on this',
    'hero.emptyTitle': 'Nothing here yet.',
    'hero.emptyLine': 'Add your first task below. One thing at a time.',
    'hero.done': 'Done',
    'hero.postpone': 'Postpone',
    'action.postpone': 'Postpone',
    'action.delete': 'Delete',
    'action.restore': 'Restore',
    'action.maximize': 'Maximize',
    'action.makeActive': 'Make active',

    'due.today': 'Today',
    'due.tomorrow': 'Tomorrow',
    'due.week': 'This week',

    'backlog.title': 'Backlog',
    'backlog.all': 'All tasks',
    'backlog.empty': 'Nothing waiting here.',
    'done.today': 'Done today',

    'bucket.morning': 'Morning',
    'bucket.afternoon': 'Afternoon',
    'bucket.evening': 'Evening',
    'bucket.night': 'Night',

    'settings.title': 'Settings',
    'settings.name': 'Your name',
    'settings.namePlaceholder': 'e.g. Sarah',
    'settings.nameHint': 'Shown in the greeting.',
    'settings.theme': 'Theme',
    'settings.language': 'Language',
    'lang.en': 'English',
    'lang.fr': 'Fran\u00e7ais',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.system': 'System',
    'settings.clear': 'Clear all data',
    'settings.clearHint': 'Removes every task, group and setting.',
    'settings.clearConfirm': 'Remove every task, group and setting? This cannot be undone.',
    'settings.shortcuts': 'Keyboard shortcuts',
    'shortcut.quickAdd': 'Quick add (toggles details)',
    'shortcut.newTask': 'New task',
    'shortcut.focusTask': 'Focus task field',
    'shortcut.openDetails': 'Toggle details while typing',
    'shortcut.home': 'Home',
    'shortcut.backlog': 'Backlog',
    'shortcut.settings': 'Settings',
    'shortcut.close': 'Close / cancel',

    'principle.label': 'Principle of the day',

    'modal.title': 'Postpone this?',
    'modal.subtitle': 'No pressure. When works better?',
    'modal.laterToday': 'Later today',
    'modal.tomorrow': 'Tomorrow',
    'modal.week': 'This week',
    'modal.reasonLabel': 'Why? A few honest words.',
    'modal.reasonPlaceholder': 'I am blocked on…, I need a break from it…',
    'modal.reasonHint': 'A short reason first — this keeps delays honest.',
    'modal.reasonGood': 'Good. Honest delays are allowed.',
    'modal.keep': 'Keep it here',
    'modal.move': 'Move it',

    'titlebar.minimize': 'Minimize',
    'titlebar.maximize': 'Maximize',
    'titlebar.restore': 'Restore',
    'titlebar.close': 'Close',
    'titlebar.toggleTheme': 'Toggle theme'
  },

  fr: {
    'nav.home': 'Accueil',
    'nav.backlog': 'Liste',
    'nav.settings': 'Réglages',
    'groups.title': 'Groupes',
    'group.new': 'Nouveau groupe',
    'group.placeholder': 'Nom du groupe',
    'group.all': 'Tous',
    'group.ungrouped': 'Sans groupe',
    'group.none': 'Aucun groupe',
    'group.moveTo': 'Déplacer dans un groupe',

    'composer.placeholder': 'Qu\u2019est-ce qu\u2019il faut faire\u00a0?',
    'composer.details': 'Détails',
    'composer.addTask': 'Ajouter une tâche',
    'composer.priority': 'Priorité',
    'composer.timebox': 'Temps prévu',
    'composer.whenWhere': 'Quand & où',
    'composer.contextPlaceholder': 'ex. À mon bureau, après le déjeuner',
    'composer.guessHint': 'Échéance détectée : {due}',
    'composer.group': 'Groupe',
    'priority.high': 'Haute',
    'priority.medium': 'Moyenne',
    'priority.low': 'Basse',

    'hero.focus': 'Concentre-toi sur ça',
    'hero.emptyTitle': 'Rien ici pour l\u2019instant.',
    'hero.emptyLine': 'Ajoute ta première tâche ci-dessous. Une chose à la fois.',
    'hero.done': 'Fait',
    'hero.postpone': 'Repousser',
    'action.postpone': 'Repousser',
    'action.delete': 'Supprimer',
    'action.restore': 'Rétablir',
    'action.maximize': 'Agrandir',
    'action.makeActive': 'Rendre active',

    'due.today': 'Aujourd\u2019hui',
    'due.tomorrow': 'Demain',
    'due.week': 'Cette semaine',

    'backlog.title': 'Liste',
    'backlog.all': 'Toutes les tâches',
    'backlog.empty': 'Rien en attente ici.',
    'done.today': 'Fait aujourd\u2019hui',

    'bucket.morning': 'Matin',
    'bucket.afternoon': 'Après-midi',
    'bucket.evening': 'Soir',
    'bucket.night': 'Nuit',

    'settings.title': 'Réglages',
    'settings.name': 'Ton nom',
    'settings.namePlaceholder': 'ex. Sarah',
    'settings.nameHint': 'Affiché dans le message d\u2019accueil.',
    'settings.theme': 'Thème',
    'settings.language': 'Langue',
    'lang.en': 'Anglais',
    'lang.fr': 'Français',
    'theme.light': 'Clair',
    'theme.dark': 'Sombre',
    'theme.system': 'Système',
    'settings.clear': 'Tout effacer',
    'settings.clearHint': 'Supprime toutes les tâches, les groupes et les réglages.',
    'settings.clearConfirm': 'Supprimer toutes les tâches, les groupes et les réglages\u00a0? Cette action est irréversible.',
    'settings.shortcuts': 'Raccourcis clavier',
    'shortcut.quickAdd': 'Ajout rapide (bascule les détails)',
    'shortcut.newTask': 'Nouvelle tâche',
    'shortcut.focusTask': 'Champ de tâche',
    'shortcut.openDetails': 'Basculer les détails en tapant',
    'shortcut.home': 'Accueil',
    'shortcut.backlog': 'Liste',
    'shortcut.settings': 'Réglages',
    'shortcut.close': 'Fermer / annuler',

    'principle.label': 'Principe du jour',

    'modal.title': 'Repousser cette tâche\u00a0?',
    'modal.subtitle': 'Sans pression. Quand préfères-tu\u00a0?',
    'modal.laterToday': 'Plus tard aujourd\u2019hui',
    'modal.tomorrow': 'Demain',
    'modal.week': 'Cette semaine',
    'modal.reasonLabel': 'Pourquoi\u00a0? Quelques mots honnêtes.',
    'modal.reasonPlaceholder': 'Je suis bloqué(e) sur…, j\u2019ai besoin d\u2019une pause…',
    'modal.reasonHint': 'D\u2019abord une petite raison — ça garde les reports honnêtes.',
    'modal.reasonGood': 'Bien. Les reports honnêtes sont autorisés.',
    'modal.keep': 'La garder ici',
    'modal.move': 'Déplacer',

    'titlebar.minimize': 'Réduire',
    'titlebar.maximize': 'Agrandir',
    'titlebar.restore': 'Rétablir',
    'titlebar.close': 'Fermer',
    'titlebar.toggleTheme': 'Changer de thème'
  }
};

export const GREETINGS = {
  en: {
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
  },

  fr: {
    morning: {
      none: [
        { label: 'Bonjour.', line: 'Pas de pression — juste une petite chose quand tu es prêt(e).' },
        { label: 'Bonjour.', line: 'Un début lent compte quand même comme un début.' },
        { label: 'Bonjour.', line: 'Quelle est l\u2019unique chose qui rendrait ta journée complète\u00a0?' }
      ],
      one: [
        { label: 'Bonjour.', line: 'Déjà une chose de faite. Doucement, on continue.' },
        { label: 'Bonjour.', line: 'Un premier pas est derrière toi. Bien joué.' }
      ],
      many: [
        { label: 'Bonjour.', line: 'Tu as déjà fait N choses aujourd\u2019hui. C\u2019est un vrai commencement.' },
        { label: 'Bonjour.', line: 'N de faites. Ta journée a pris forme.' }
      ]
    },
    afternoon: {
      none: [
        { label: 'Bon après-midi.', line: 'La journée n\u2019est pas finie. Une petite chose suffit.' },
        { label: 'Après-midi.', line: 'Une tâche courte maintenant vaut mieux qu\u2019une longue plus tard.' }
      ],
      one: [
        { label: 'Bon après-midi.', line: 'Une de faite aujourd\u2019hui. La prochaine est plus proche que tu ne le crois.' },
        { label: 'Après-midi.', line: 'Tu as commencé. C\u2019est la moitié du travail.' }
      ],
      many: [
        { label: 'Bon après-midi.', line: 'N choses faites aujourd\u2019hui. Continue à ton rythme.' },
        { label: 'Après-midi.', line: 'N déjà faites. Il reste de la lumière, sans te presser.' }
      ]
    },
    evening: {
      none: [
        { label: 'Bonsoir.', line: 'Le soir va bien aux tâches faciles. Choisis quelque chose de minuscule.' },
        { label: 'Soir.', line: 'Une petite chose, puis repose-toi.' }
      ],
      one: [
        { label: 'Bonsoir.', line: 'Une chose faite aujourd\u2019hui — de quoi construire.' },
        { label: 'Soir.', line: 'Tu en as fait une aujourd\u2019hui. Ça compte.' }
      ],
      many: [
        { label: 'Bonsoir.', line: 'N choses faites aujourd\u2019hui. Regarde ce que ça donne.' },
        { label: 'Soir.', line: 'N de faites. Un bon moment pour s\u2019arrêter.' }
      ]
    },
    night: {
      none: [
        { label: 'Il est tard.', line: 'Le repos compte. Si tu fais quelque chose, que ce soit petit et doux.' },
        { label: 'Encore tard.', line: 'Rien de fait, c\u2019est bien aussi. Demain a de la place.' }
      ],
      one: [
        { label: 'Il est tard.', line: 'Tu en as fait une aujourd\u2019hui. Ça suffit pour compter.' },
        { label: 'Tard.', line: 'Une de faite. Laisse la journée se fermer.' }
      ],
      many: [
        { label: 'Il est tard.', line: 'N choses faites aujourd\u2019hui. Il est temps de laisser la journée se fermer.' },
        { label: 'Tard.', line: 'N de faites. Repose-toi bien.' }
      ]
    }
  }
};

export const PRINCIPLES = {
  en: [
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
  ],

  fr: [
    { name: 'La loi de Hick', line: 'Moins de choix, plus vite on agit.', why: 'Chaque option visible est une décision. Une seule tâche à l\u2019écran élimine le coût de choisir.' },
    { name: 'L\u2019effet Zeigarnik', line: 'Les tâches inachevées restent en tête.', why: 'Les boucles ouvertes hantent l\u2019esprit. Les fermer — même par petites étapes — libère ton attention.' },
    { name: 'Les intentions d\u2019implémentation', line: 'Prévois le quand et le où.', why: 'Une tâche avec un moment et un lieu a deux à trois fois plus de chances d\u2019être accomplie.' },
    { name: 'La conception par friction', line: 'Rends le report honnête.', why: 'Quand repousser coûte un petit effort, tu reportes pour de vraies raisons, pas par impulsion.' },
    { name: 'Les micro-étapes', line: 'Réduis la tâche jusqu\u2019à ce qu\u2019elle soit facile.', why: 'Les tâches vagues et volumineuses déclenchent une réaction de menace ; les petites étapes la contournent.' },
    { name: 'Le résidu d\u2019attention', line: 'Une seule chose à la fois.', why: 'Changer de tâche laisse un résidu mental. Un seul focus protège ton attention.' },
    { name: 'Le nouveau départ', line: 'Chaque jour est une page blanche.', why: 'Une série interrompue n\u2019est pas un échec. Aujourd\u2019hui recommence à zéro, sans honte.' },
    { name: 'Les petites victoires', line: 'Marque la fin.', why: 'Un progrès visible libère la tension du travail inachevé et crée de l\u2019élan.' },
    { name: 'Le calme visuel', line: 'Des écrans plus doux, un esprit plus clair.', why: 'Une interface calme réduit l\u2019anxiété — pas de couleurs agressives, pas de reproches visuels.' },
    { name: 'L\u2019ajustement à l\u2019énergie', line: 'Fais la bonne tâche au bon moment.', why: 'Associer une tâche à ton énergie du moment rend le démarrage possible.' }
  ]
};
