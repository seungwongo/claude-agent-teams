import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

function getSnapshot(): string {
  const home = os.homedir();
  const parts: string[] = [];

  // Watch ~/.claude/tasks/
  const tasksDir = path.join(home, '.claude', 'tasks');
  try {
    if (fs.existsSync(tasksDir)) {
      for (const d of fs.readdirSync(tasksDir, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        const files = fs.readdirSync(path.join(tasksDir, d.name)).filter(f => f.endsWith('.json'));
        for (const f of files) {
          try { parts.push(String(fs.statSync(path.join(tasksDir, d.name, f)).mtimeMs)); } catch { /* */ }
        }
      }
    }
  } catch { /* */ }

  // Watch ~/.claude/todos/
  const todosDir = path.join(home, '.claude', 'todos');
  try {
    if (fs.existsSync(todosDir)) {
      for (const f of fs.readdirSync(todosDir)) {
        if (!f.endsWith('.json')) continue;
        try { parts.push(String(fs.statSync(path.join(todosDir, f)).mtimeMs)); } catch { /* */ }
      }
    }
  } catch { /* */ }

  return parts.join('|');
}

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let lastSnapshot = '';

      function tick() {
        try {
          const current = getSnapshot();
          if (current !== lastSnapshot) {
            lastSnapshot = current;
            controller.enqueue(encoder.encode('data: update\n\n'));
          } else {
            controller.enqueue(encoder.encode(': ping\n\n'));
          }
        } catch { /* ignore */ }
      }

      tick();
      const interval = setInterval(tick, 2000);
      return () => clearInterval(interval);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
