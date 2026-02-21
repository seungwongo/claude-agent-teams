'use client';

import { Task } from '@/app/api/teams/route';

interface TaskCardProps {
  task: Task;
  isStale?: boolean;
}

const statusConfig = {
  pending:     { color: 'text-slate-400', bg: 'bg-slate-800/40',   border: 'border-slate-700/50', dot: 'bg-slate-500',   label: 'Pending' },
  in_progress: { color: 'text-blue-400',  bg: 'bg-blue-950/40',    border: 'border-blue-800/50',  dot: 'bg-blue-400',    label: 'In Progress' },
  completed:   { color: 'text-emerald-400',bg: 'bg-emerald-950/40',border: 'border-emerald-800/50',dot: 'bg-emerald-400', label: 'Completed' },
  blocked:     { color: 'text-red-400',   bg: 'bg-red-950/40',     border: 'border-red-800/50',   dot: 'bg-red-400',     label: 'Blocked' },
  deleted:     { color: 'text-slate-600', bg: 'bg-slate-900/40',   border: 'border-slate-800/50', dot: 'bg-slate-600',   label: 'Deleted' },
};

const priorityConfig = {
  high:   { text: 'text-red-400',    bg: 'bg-red-950/50',    border: 'border-red-800/40',    label: '↑ High' },
  medium: { text: 'text-amber-400',  bg: 'bg-amber-950/50',  border: 'border-amber-800/40',  label: '→ Medium' },
  low:    { text: 'text-slate-500',  bg: 'bg-slate-800/50',  border: 'border-slate-700/40',  label: '↓ Low' },
};

const staleInterrupted = {
  color: 'text-slate-600', bg: 'bg-slate-900/30', border: 'border-slate-800/30', dot: 'bg-slate-700',
};

export default function TaskCard({ task, isStale = false }: TaskCardProps) {
  const cfg = statusConfig[task.status] ?? statusConfig.pending;
  const isActive = task.status === 'in_progress';
  const isInterrupted = isStale && (task.status === 'pending' || task.status === 'in_progress');
  const effectiveCfg = isInterrupted ? { ...cfg, ...staleInterrupted } : cfg;
  const pri = task.priority ? priorityConfig[task.priority] : null;

  return (
    <div className={`${effectiveCfg.bg} ${effectiveCfg.border} border rounded-lg p-3 animate-slide-in transition-all duration-200 hover:brightness-110 ${isInterrupted ? 'opacity-60' : ''}`}>
      {/* Interrupted banner */}
      {isInterrupted && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-amber-700/80 bg-amber-950/30 border border-amber-900/30 px-1.5 py-0.5 rounded-full">
            interrupted
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-2 mb-1.5">
        <span className={`${effectiveCfg.color} text-xs mt-0.5 shrink-0 font-mono`}>#{task.id}</span>
        <p className={`text-sm font-medium leading-snug flex-1 ${isInterrupted ? 'text-slate-500' : isActive ? 'text-white' : 'text-slate-200'}`}>
          {task.subject}
        </p>
      </div>

      {/* Active form */}
      {isActive && !isStale && task.activeForm && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse-dot shrink-0`} />
          <span className="text-xs text-blue-300 italic">{task.activeForm}</span>
        </div>
      )}

      {/* Description */}
      {task.description && (
        <p className={`text-xs leading-relaxed line-clamp-2 mb-1.5 ${isInterrupted ? 'text-slate-600' : 'text-slate-400'}`}>
          {task.description}
        </p>
      )}

      {/* Footer */}
      {!isInterrupted && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${isActive && !isStale ? 'animate-pulse-dot' : ''}`} />
            <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {pri && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${pri.text} ${pri.bg} ${pri.border}`}>
                {pri.label}
              </span>
            )}
            {task.owner && (
              <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                {task.owner}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Dependency badges */}
      {(task.blockedBy.length > 0 || task.blocks.length > 0) && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.blockedBy.map(id => (
            <span key={id} className="text-xs bg-red-950 text-red-400 border border-red-800/50 px-1.5 py-0.5 rounded-full">
              blocked by #{id}
            </span>
          ))}
          {task.blocks.map(id => (
            <span key={id} className="text-xs bg-amber-950 text-amber-400 border border-amber-800/50 px-1.5 py-0.5 rounded-full">
              blocks #{id}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
