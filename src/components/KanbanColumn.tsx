'use client';

import { Task } from '@/app/api/teams/route';
import TaskCard from './TaskCard';

interface KanbanColumnProps {
  title: string;
  status: Task['status'];
  tasks: Task[];
  icon: string;
  color: string;
  headerBg: string;
  isStale?: boolean;
}

export default function KanbanColumn({
  title,
  status,
  tasks,
  icon,
  color,
  headerBg,
  isStale = false,
}: KanbanColumnProps) {
  // In stale sessions, pending/in_progress are "interrupted" – highlight them
  const isOrphanedColumn = isStale && (status === 'pending' || status === 'in_progress');

  return (
    <div className="flex flex-col min-w-[260px] max-w-[300px] flex-1">
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${headerBg} border border-b-0 border-white/5`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className={`text-sm font-semibold ${color}`}>{title}</span>
          {isOrphanedColumn && tasks.length > 0 && (
            <span className="text-xs text-amber-600/80" title="Session ended with tasks in this state">
              ⚠
            </span>
          )}
        </div>
        <span className={`text-xs font-bold ${color} bg-black/20 px-2 py-0.5 rounded-full`}>
          {tasks.length}
        </span>
      </div>

      {/* Tasks container */}
      <div
        className={`
          flex-1 flex flex-col gap-2 p-2
          bg-slate-900/30 border border-white/5 rounded-b-xl
          min-h-[120px] overflow-y-auto scrollbar-thin
          ${isOrphanedColumn && tasks.length > 0 ? 'border-amber-900/20' : ''}
        `}
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-slate-700 text-xs">
            No tasks
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard key={task.id} task={task} isStale={isStale} />
          ))
        )}
      </div>
    </div>
  );
}
