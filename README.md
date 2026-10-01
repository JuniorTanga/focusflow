# FocusFlow

A calm, single-task, bilingual (English / French) anti-procrastination desktop app.

One task at a time. The hero shows exactly what matters now, everything else waits
in the backlog. Due tasks rise on their own, and routines come back on their own.
No account, no backend, no network: everything lives on your machine.

## Features

- **One task at a time**: a single hero card, with the rest waiting in the backlog.
- **Honest postponing**: moving a task asks why, and the reason is kept with it.
- **Bilingual EN / FR**: interface, greetings, principles of the day and due-date
  guessing all switch with one setting.
- **Due-date guessing**: write "tomorrow morning", "next monday", "in three days"
  or "vendredi prochain" in the *When & where* field and the app suggests the due
  date, live, before you save.
- **Automatic promotion**: due tasks roll into Today on their own. The most overdue
  task leads, then the fresh ones. A pinned task always wins.
- **Routines**: their own tab. Daily, weekly on a chosen weekday, monthly on a chosen
  day, or every N days. The first occurrence is due today, and completing one spawns
  the next on its scheduled date. Pause or delete a routine to stop it.
- **Groups, priorities and time-boxes** for shaping the backlog.
- **Light / dark / system themes** and keyboard shortcuts.
- **Local-first**: tasks live in `localStorage`, nothing leaves the machine.

## Quick start

Requires Node.js 18 or newer.

```bash
npm install     # install dependencies (Electron)
npm start       # launch the app
npm test        # run the unit tests (node:test)
npm run pack:win  # build a Windows x64 app into dist/
```

On WSL2, Electron needs the ALSA library. If it fails to launch with a missing
`libasound.so.2`, install it with:

```bash
sudo apt install libasound2t64
```

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `/` | Quick add (toggles the details panel) |
| `Ctrl+N` | New task |
| `Ctrl+K` | Focus the task field |
| `Ctrl+1` | Home |
| `Ctrl+2` | Backlog |
| `Ctrl+3` | Routines |
| `Ctrl+4` | Settings |
| `Esc` | Close / cancel |

## Project layout

```
.
├── main.js            # Electron main process (window, single instance)
├── preload.js         # context bridge (minimize / maximize / close only)
├── package.json
├── renderer/
│   ├── index.html     # app shell and views
│   ├── app.js         # DOM wiring and UI state
│   ├── logic.js       # pure logic: due dates, sorting, routines, guessing
│   ├── i18n.js        # EN / FR strings, greetings, principles
│   ├── icons.js       # inline SVG icons
│   ├── styles.css
│   ├── fonts.css
│   └── fonts/         # woff2 files (refresh with `npm run fonts`)
├── scripts/
│   └── fetch-fonts.mjs
└── test/
    └── logic.test.mjs # unit tests for the pure logic
```

The interesting decisions live in `renderer/logic.js`: due-date stamping,
day-boundary rollover, overdue ranking, routine scheduling and the due-date
guesser. It has no DOM and no Electron imports, which is why it is easy to test.

## Where the data lives

Electron stores the app state (`localStorage`, key `focusflow.v1`) under its user
data directory:

- Linux: `~/.config/focusflow`
- Windows: `%APPDATA%\focusflow`

Clearing data from the Settings tab removes every task, group, routine and setting.

## License

MIT. See [LICENSE](LICENSE).