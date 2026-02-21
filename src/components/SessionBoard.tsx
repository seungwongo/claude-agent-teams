'use client';

import { Session, Task } from '@/app/api/teams/route';
import KanbanColumn from './KanbanColumn';

interface SessionBoardProps {
  session: Session;
  isExpanded: boolean;
  onToggle: () => void;
  searchQuery?: string;
}

const COLUMNS: { status: Task['status']; title: string; icon: string; color: string; headerBg: string }[] = [
  { status: 'pending',     title: 'Pending',     icon: '○', color: 'text-slate-300',   headerBg: 'bg-slate-800/60' },
  { status: 'in_progress', title: 'In Progress', icon: '◐', color: 'text-blue-300',    headerBg: 'bg-blue-900/40' },
  { status: 'completed',   title: 'Completed',   icon: '●', color: 'text-emerald-300', headerBg: 'bg-emerald-900/40' },
  { status: 'blocked',     title: 'Blocked',     icon: '✕', color: 'text-red-300',     headerBg: 'bg-red-900/40' },
];

export default function SessionBoard({ session, isExpanded, onToggle, searchQuery = '' }: SessionBoardProps) {
  const { isStale, source } = session;

  // When searching, only show tasks that match the query
  const visibleTasks = searchQuery
    ? session.tasks.filter(t =>
        t.subject.toLowerCase().includes(searchQuery) ||
        (t.description ?? '').toLowerCase().includes(searchQuery)
      )
    : session.tasks;

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.status] = visibleTasks.filter(t => t.status === col.status);
    return acc;
  }, {} as Record<string, Task[]>);

  const total = session.tasks.length;
  const matchCount = searchQuery ? visibleTasks.length : 0;
  const completedCount = (searchQuery ? 0 : tasksByStatus['completed']?.length) ?? tasksByStatus['completed']?.length ?? 0;
  const inProgressCount = tasksByStatus['in_progress']?.length ?? 0;
  const pendingCount = tasksByStatus['pending']?.length ?? 0;
  const blockedCount = tasksByStatus['blocked']?.length ?? 0;
  const orphanedCount = isStale ? inProgressCount + pendingCount : 0;
  // Progress based on full task list (not filtered)
  const allCompleted = session.tasks.filter(t => t.status === 'completed').length;
  const progress = total > 0 ? Math.round((allCompleted / total) * 100) : 100;
  const allTasksCleared = total === 0 && source === 'tasks';
  const timeAgo = formatTimeAgo(new Date(session.lastModified));

  const sourceBadge = source === 'todos'
    ? { label: 'TodoWrite', bg: 'bg-violet-950/50', border: 'border-violet-800/40', text: 'text-violet-400' }
    : { label: 'Agent Tasks', bg: 'bg-blue-950/50', border: 'border-blue-800/40', text: 'text-blue-400' };

  return (
    <div className={`border rounded-2xl overflow-hidden transition-opacity ${
      isStale ? 'bg-slate-900/20 border-white/4 opacity-60 hover:opacity-80' : 'bg-slate-900/50 border-white/8'
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex flex-col gap-0.5 min-w-0">
            {/* Row 1: name + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold text-sm ${isStale ? 'text-slate-400' : 'text-white'}`}>
                {session.name}
              </span>

              {/* Source badge */}
              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${sourceBadge.bg} ${sourceBadge.border} ${sourceBadge.text}`}>
                {sourceBadge.label}
              </span>

              {searchQuery && (
                <span className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.5 rounded-full">
                  {matchCount} match{matchCount !== 1 ? 'es' : ''}
                </span>
              )}
              {allTasksCleared && !isStale && (
                <span className="flex items-center gap-1 text-xs text-emerald-500/80 bg-emerald-950/30 border border-emerald-800/30 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  all tasks done
                </span>
              )}
              {isStale && (
                <span className="text-xs text-slate-500 bg-slate-800/80 border border-slate-700/50 px-1.5 py-0.5 rounded-full">
                  Session ended
                </span>
              )}
              {orphanedCount > 0 && (
                <span className="text-xs text-amber-500 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.5 rounded-full">
                  {orphanedCount} interrupted
                </span>
              )}
              {!isStale && inProgressCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-950/60 border border-blue-800/40 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse-dot" />
                  {inProgressCount} active
                </span>
              )}
              {!isStale && blockedCount > 0 && (
                <span className="text-xs text-red-400 bg-red-950/60 border border-red-800/40 px-1.5 py-0.5 rounded-full">
                  {blockedCount} blocked
                </span>
              )}
            </div>

            {/* Row 2: meta */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-600">
                {allTasksCleared ? `all cleared · ${timeAgo}` : `${total} tasks · ${completedCount} done · ${timeAgo}`}
              </span>
              {session.members && session.members.length > 0 && (
                <div className="flex items-center gap-1">
                  {session.members.map(m => (
                    <span key={m.agentId} className="text-xs text-violet-400/60 bg-violet-950/30 border border-violet-800/30 px-1.5 py-0.5 rounded-full" title={m.agentType}>
                      {m.name}
                    </span>
                  ))}
                </div>
              )}
              {source === 'todos' && session.agentIds.length > 1 && (
                <span className="text-xs text-slate-600">{session.agentIds.length} agents</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0 ml-4">
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isStale ? 'bg-slate-600' : 'bg-emerald-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 w-8 text-right">{progress}%</span>
          </div>
          <span className={`text-sm transition-transform duration-200 ${isStale ? 'text-slate-600' : 'text-slate-400'} ${isExpanded ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-white/5">
          {isStale && orphanedCount > 0 && (
            <div className="mt-3 mb-1 px-1">
              <span className="text-xs text-amber-600/80">
                ⚠ {orphanedCount} task{orphanedCount > 1 ? 's were' : ' was'} pending/in-progress when this session ended.
              </span>
            </div>
          )}
          {allTasksCleared ? (
            <div className="flex items-center justify-center h-20 mt-3">
              <span className="text-xs text-slate-600">All tasks were completed and cleared by the agent team.</span>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-1 pt-3">
              {COLUMNS.map(col => (
                <KanbanColumn
                  key={col.status}
                  title={col.title}
                  status={col.status}
                  tasks={tasksByStatus[col.status] ?? []}
                  icon={col.icon}
                  color={isStale ? 'text-slate-600' : col.color}
                  headerBg={isStale ? 'bg-slate-800/30' : col.headerBg}
                  isStale={isStale}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hour < 24) return `${hour}h ago`;
  return `${day}d ago`;
}
