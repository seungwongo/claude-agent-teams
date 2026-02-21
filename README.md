# Claude Agent Teams – Kanban Monitor

A real-time Kanban board for monitoring Claude Code agent team tasks. Reads directly from `~/.claude/tasks/` and `~/.claude/todos/` — no configuration required.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)

## Overview

Claude Code writes task data to two locations on your machine:

| Source | Path | Written by |
|--------|------|-----------|
| **Agent Tasks** | `~/.claude/tasks/{team-id}/{task-id}.json` | `TaskCreate` / `TaskUpdate` tools (agent teams) |
| **TodoWrite** | `~/.claude/todos/{session-id}-agent-{agent-id}.json` | `TodoWrite` tool (any Claude Code session) |

This monitor reads both sources and displays them as a unified Kanban board, updating in real time via Server-Sent Events.

## Features

- **Real-time updates** — SSE stream polls file changes every 2 seconds, no page refresh needed
- **Dual source support** — monitors both Agent Tasks (`TaskCreate`) and TodoWrite sessions
- **Kanban columns** — Pending / In Progress / Completed / Blocked
- **Session grouping** — tasks grouped by team or session, with member names when available
- **Stale detection** — sessions with no updates for over 1 hour are marked as ended
- **Interrupted task badges** — highlights tasks that were pending/in-progress when a session ended
- **Search & filter** — filter by status (Active / All / Ended), source (Agent Tasks / TodoWrite), or keyword
- **Progress bar** — completion percentage per session
- **Expand / collapse** — toggle individual boards or all at once

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Enabling Agent Teams in Claude Code

Add the following to `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "tmux"
}
```

> `teammateMode: "tmux"` spawns each agent in a separate tmux pane. Task files are still written to the same `~/.claude/tasks/` path and will appear in the monitor.

## Data Sources

### Agent Tasks (`~/.claude/tasks/`)

Each agent team session creates a directory identified by a UUID. Task files are written as individual JSON files:

```
~/.claude/tasks/
└── {team-id}/
    ├── .lock
    ├── .highwatermark
    ├── 1.json       ← Task #1
    ├── 2.json       ← Task #2
    └── ...
```

Task JSON structure:
```json
{
  "id": "1",
  "subject": "Implement authentication module",
  "description": "...",
  "activeForm": "Implementing authentication module",
  "status": "in_progress",
  "priority": "high",
  "blocks": ["3"],
  "blockedBy": [],
  "owner": "backend-agent"
}
```

Team metadata (optional):
```
~/.claude/teams/{team-id}/config.json
```

### TodoWrite (`~/.claude/todos/`)

Every Claude Code session can write todos via the `TodoWrite` tool. Files follow the naming pattern:

```
~/.claude/todos/{session-id}-agent-{agent-id}.json
```

## Tech Stack

- **Next.js 16** (App Router) with TypeScript
- **Tailwind CSS 4** for styling
- **Server-Sent Events** for real-time file change detection
- No database — reads directly from the filesystem

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── teams/
│   │       ├── route.ts        ← GET /api/teams — reads all sessions
│   │       └── stream/
│   │           └── route.ts    ← GET /api/teams/stream — SSE endpoint
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
└── components/
    ├── KanbanDashboard.tsx     ← Main dashboard with filters and stats
    ├── SessionBoard.tsx        ← Per-session collapsible Kanban board
    ├── KanbanColumn.tsx        ← Single status column
    └── TaskCard.tsx            ← Individual task card
```
