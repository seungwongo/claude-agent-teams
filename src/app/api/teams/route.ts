import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface Task {
  id: string;
  subject: string;
  description?: string;
  activeForm?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'deleted';
  priority?: 'high' | 'medium' | 'low';
  blocks: string[];
  blockedBy: string[];
  owner?: string;
}

export interface TeamMember {
  name: string;
  agentId: string;
  agentType: string;
}

export type SessionSource = 'tasks' | 'todos';

export interface Session {
  id: string;
  name: string;
  source: SessionSource;
  description?: string;
  members?: TeamMember[];
  agentIds: string[];       // todos: one per agent file; tasks: just [id]
  tasks: Task[];
  lastModified: number;
  isStale: boolean;
}

// Sessions with no updates for this duration are considered ended
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

// ─── helpers ────────────────────────────────────────────────────────────────

function homeDir() { return os.homedir(); }

function getTeamInfo(teamId: string): { name: string; description?: string; members?: TeamMember[] } {
  const teamsDir = path.join(homeDir(), '.claude', 'teams');
  try {
    const configPath = path.join(teamsDir, teamId, 'config.json');
    if (fs.existsSync(configPath)) {
      const c = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { name: c.name || c.team_name || teamId, description: c.description, members: c.members };
    }
    const teamFile = path.join(teamsDir, `${teamId}.json`);
    if (fs.existsSync(teamFile)) {
      const c = JSON.parse(fs.readFileSync(teamFile, 'utf-8'));
      return { name: c.name || c.team_name || teamId, description: c.description, members: c.members };
    }
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(teamId)) return { name: teamId };
  } catch { /* ignore */ }
  return { name: teamId.slice(0, 8) };
}

function sortById(tasks: Task[]) {
  tasks.sort((a, b) => {
    const na = parseInt(a.id, 10), nb = parseInt(b.id, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.id.localeCompare(b.id);
  });
}

// ─── source: ~/.claude/tasks/ ───────────────────────────────────────────────

function readTasksSessions(): Session[] {
  const tasksDir = path.join(homeDir(), '.claude', 'tasks');
  if (!fs.existsSync(tasksDir)) return [];

  const sessions: Session[] = [];

  for (const entry of fs.readdirSync(tasksDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const teamId = entry.name;
    const teamPath = path.join(tasksDir, teamId);
    const allEntries = fs.readdirSync(teamPath);
    const files = allEntries.filter(f => f.endsWith('.json') && !f.startsWith('.'));

    // Use .highwatermark or .lock mtime as fallback for lastModified when no task files exist
    let lastModified = 0;
    for (const dotFile of ['.highwatermark', '.lock']) {
      try {
        const s = fs.statSync(path.join(teamPath, dotFile));
        if (s.mtimeMs > lastModified) lastModified = s.mtimeMs;
      } catch { /* skip */ }
    }

    // Skip if no activity marker at all
    const hasMarker = allEntries.includes('.highwatermark') || allEntries.includes('.lock');
    if (!hasMarker && files.length === 0) continue;

    const tasks: Task[] = [];

    for (const file of files) {
      const filePath = path.join(teamPath, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs > lastModified) lastModified = stat.mtimeMs;
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (raw.status !== 'deleted') {
          // Use filename (e.g. "1") as fallback id if raw.id is missing
          const fallbackId = path.basename(file, '.json');
          tasks.push({
            id: raw.id != null ? String(raw.id) : fallbackId,
            subject: raw.subject ?? '(no subject)',
            description: raw.description,
            activeForm: raw.activeForm,
            status: raw.status ?? 'pending',
            priority: raw.priority,
            blocks: raw.blocks ?? [],
            blockedBy: raw.blockedBy ?? [],
            owner: raw.owner,
          });
        }
      } catch { /* skip */ }
    }

    // Show even if all tasks are deleted (tasks=[]) — team exists but completed all work
    sortById(tasks);

    const info = getTeamInfo(teamId);
    sessions.push({
      id: teamId,
      name: info.name,
      source: 'tasks',
      description: info.description,
      members: info.members,
      agentIds: [teamId],
      tasks,
      lastModified,
      isStale: (Date.now() - lastModified) > STALE_THRESHOLD_MS,
    });
  }

  return sessions;
}

// ─── source: ~/.claude/todos/ ───────────────────────────────────────────────

function readTodosSessions(): Session[] {
  const todosDir = path.join(homeDir(), '.claude', 'todos');
  if (!fs.existsSync(todosDir)) return [];

  // Group files by session-id (first UUID in filename)
  // Filename pattern: {session-id}-agent-{agent-id}.json
  const bySession = new Map<string, { agentId: string; filePath: string; mtime: number }[]>();

  for (const file of fs.readdirSync(todosDir)) {
    if (!file.endsWith('.json')) continue;
    const base = file.slice(0, -5); // strip .json
    const match = base.match(/^([0-9a-f-]{36})-agent-([0-9a-f-]{36})$/i);
    if (!match) continue;
    const [, sessionId, agentId] = match;
    const filePath = path.join(todosDir, file);
    try {
      const mtime = fs.statSync(filePath).mtimeMs;
      if (!bySession.has(sessionId)) bySession.set(sessionId, []);
      bySession.get(sessionId)!.push({ agentId, filePath, mtime });
    } catch { /* skip */ }
  }

  const sessions: Session[] = [];

  for (const [sessionId, agents] of bySession) {
    const tasks: Task[] = [];
    let lastModified = 0;
    const agentIds: string[] = [];

    for (const { agentId, filePath, mtime } of agents) {
      if (mtime > lastModified) lastModified = mtime;
      agentIds.push(agentId);
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Array<{
          id: string | number;
          content: string;
          status: string;
          priority?: string;
          activeForm?: string;
        }>;
        if (!Array.isArray(raw)) continue;

        const isSolo = sessionId === agentId;
        const agentPrefix = agentId.slice(0, 6);
        for (let idx = 0; idx < raw.length; idx++) {
          const item = raw[idx];
          // Guarantee a unique, non-undefined id:
          // solo sessions: use item.id with index fallback
          // multi-agent: prefix with agentId slice to avoid cross-agent collisions
          const rawId = item.id != null ? String(item.id) : String(idx);
          const taskId = isSolo ? rawId : `${agentPrefix}-${rawId}`;

          const status = (['pending', 'in_progress', 'completed', 'blocked', 'deleted'] as const)
            .includes(item.status as never) ? item.status as Task['status'] : 'pending';
          const priority = (['high', 'medium', 'low'] as const)
            .includes(item.priority as never) ? item.priority as Task['priority'] : undefined;
          if (status === 'deleted') continue;
          tasks.push({
            id: taskId,
            subject: item.content ?? '(no content)',
            activeForm: item.activeForm,
            status,
            priority,
            blocks: [],
            blockedBy: [],
            owner: isSolo ? undefined : agentId.slice(0, 8),
          });
        }
      } catch { /* skip */ }
    }

    if (tasks.length === 0) continue;
    sortById(tasks);

    const isMultiAgent = new Set(agentIds).size > 1;
    const label = isMultiAgent
      ? `Session ${sessionId.slice(0, 8)} (${agentIds.length} agents)`
      : `Session ${sessionId.slice(0, 8)}`;

    sessions.push({
      id: `todos-${sessionId}`,
      name: label,
      source: 'todos',
      agentIds,
      tasks,
      lastModified,
      isStale: (Date.now() - lastModified) > STALE_THRESHOLD_MS,
    });
  }

  return sessions;
}

// ─── route handler ──────────────────────────────────────────────────────────

export async function GET() {
  try {
    const tasksSessions = readTasksSessions();
    const todosSessions = readTodosSessions();

    const all: Session[] = [...tasksSessions, ...todosSessions];
    all.sort((a, b) => b.lastModified - a.lastModified);

    return NextResponse.json({ sessions: all });
  } catch (error) {
    console.error('Error reading sessions:', error);
    return NextResponse.json({ error: 'Failed to read sessions' }, { status: 500 });
  }
}
