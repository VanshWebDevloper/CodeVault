# CodeVault
​
Your desktop, in the browser. CodeVault is a Windows-style workspace for students and developers that bundles a code editor, notes, and tasks into one place. I built it because I wanted somewhere to code, note things down, and plan my day without juggling a bunch of tabs.
​
It's still in progress, but it works. Open the live site and you get a desktop-style home screen with app tiles, a search bar, and a taskbar. Click an app and it opens, like an OS should.
​
**Live preview: https://vanshwebdevloper.github.io/CodeVault**
​
## What's inside
​
- A home screen that looks and feels like a desktop OS, with app tiles you can launch and search
- A code editor for writing and running snippets
- A notes app for quick, no-friction notetaking
- A tasks app for keeping track of what needs doing
​
Nothing fancy under the hood. Plain HTML, CSS, and JavaScript. AI helped with the database side, the analytics tracking, some of the editor polish, and the responsiveness work.
​
## The apps
​
### Code Editor
​
A small IDE-style editor: an explorer sidebar, tabs, a commands search, and a Run button that shows the output below the code pane. Write something, run it, see what happens.
​
![Code Editor](docs/assets/screenshots/code-editor.png)
​
### Notes
​
Simple and easy, note it down before it slips away. Search your notes by name, give one a title, write it, save it. Works without signing in too.
​
![Notes](docs/assets/screenshots/notes.png)
​
### Tasks
​
Add, remove, or edit your tasks. Same idea as Notes: search by name, give it a title, add the details, save. Keeps your day on track without the clutter.
​
![Tasks](docs/assets/screenshots/tasks.png)
​
### Analytics

Real usage stats, tracked right in the browser. Every app logs events (notes created, tasks completed, commands run, files saved) and records how long you spend in each one, all stored per-account in localStorage. The dashboard shows total time tracked, notes created, tasks completed, commands run, a time-per-app breakdown, and activity over the last 7 days. Nothing leaves your machine.

![Analytics](docs/assets/screenshots/analytics.png)

### Terminal

A real terminal over the virtual filesystem. ls, cd, mkdir, touch, cat, echo > file, rm, mv, clear, whoami, date, history, reset-fs. Type `help` for the full list. What you do here changes the same files the Files app sees.

![Terminal](docs/assets/screenshots/terminal.png)

### Files

A file manager backed by a virtual filesystem that lives in your browser's localStorage. Create folders and files, import files from your computer, and open any file straight in the code editor. Changes sync everywhere instantly.

![Files](docs/assets/screenshots/files.png)

<!-- TODO: these are yours to fill in: -->
<!-- Why did you build CodeVault in your own words? (first section) -->
<!-- What's the plan after Terminal and Files? add a "roadmap" section here -->
<!-- Anything you want to credit or mention? people, tools, tutorials? -->
​
## Folder layout

```
CodeVault/
├── docs/                     the whole web app (served by GitHub Pages)
│   ├── index.html            the desktop-style home screen
│   ├── main.css
│   ├── index.js              app launcher, search, taskbar
│   ├── apps/
│   │   ├── code-editor.html  the code editor app
│   │   ├── notes.html        notes app
│   │   ├── tasks.html        tasks app
│   │   ├── terminal.html     terminal app
│   │   ├── files.html        files app
│   │   ├── analytics.html    analytics dashboard
│   │   ├── js/               editor, notes, tasks, terminal, files, vfs, analytics
│   │   ├── css/              styles for each app
│   │   └── ...
│   └── assets/               wallpaper, icons, screenshots
├── server/                   Express server (static serving + API)
│   ├── server.js
│   └── database.js
└── database/                 server-side data
```

## Contributing
​
Spotted something broken or have an idea? Open an issue, or fork the repo, make your branch, and send a pull request. I read everything.
​
## License
​
ISC. See LICENSE for the details.