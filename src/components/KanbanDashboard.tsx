'use client';

import { useState, useEffect, useCallback } from 'react';
import { Session } from '@/app/api/teams/route';
import SessionBoard from './SessionBoard';

type FilterStatus = 'active' | 'all' | 'ended';
type SourceFilter = 'all' | 'tasks' | 'todos';

export default function KanbanDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [filter, setFilter] = useState<FilterStatus>('active');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/teams');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const fetched: Session[] = data.sessions ?? [];
      setSessions(fetched);
      setLastUpdated(new Date());
      setLoading(false);

      // Auto-expand active (non-stale) sessions on first load
      setExpandedSessions(prev => {
        if (prev.size === 0 && fetched.length > 0) {
          return new Set(fetched.filter(s => !s.isStale).map(s => s.id));
        }
        return prev;
      });
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // SSE real-time updates
  useEffect(() => {
    let evtSource: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      evtSource = new EventSource('/api/teams/stream');
      setConnectionStatus('connecting');
      evtSource.onopen = () => setConnectionStatus('connected');
      evtSource.onerror = () => {
        setConnectionStatus('disconnected');
        evtSource.close();
        retryTimeout = setTimeout(connect, 5000);
      };
      evtSource.addEventListener('message', (e) => {
        if (e.data === 'update') fetchSessions();
      });
    }

    connect();
    return () => { clearTimeout(retryTimeout); evtSource?.close(); };
  }, [fetchSessions]);

  const toggleSession = (id: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedSessions(new Set(filtered.map(s => s.id)));
  const collapseAll = () => setExpandedSessions(new Set());

  const q = searchQuery.trim().toLowerCase();

  // Filter & search
  const filtered = sessions.filter(s => {
    if (filter === 'active' && s.isStale) return false;
    if (filter === 'ended' && !s.isStale) return false;
    if (sourceFilter !== 'all' && s.source !== sourceFilter) return false;
    if (q) {
      const matchSess = s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      const matchTask = s.tasks.some(t =>
        t.subject.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q)
      );
      if (!matchSess && !matchTask) return false;
    }
    return true;
  });

  // Auto-expand sessions with matching tasks when searching
  useEffect(() => {
    if (!q) return;
    setExpandedSessions(prev => {
      const next = new Set(prev);
      filtered.forEach(s => next.add(s.id));
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Stats (active sessions only for the main counters)
  const active = sessions.filter(s => !s.isStale);
  const ended = sessions.filter(s => s.isStale);
  const activeTasks = active.flatMap(s => s.tasks);
  const stats = {
    activeSessions: active.length,
    endedSessions: ended.length,
    todosSessions: sessions.filter(s => s.source === 'todos' && !s.isStale).length,
    tasksSessions: sessions.filter(s => s.source === 'tasks' && !s.isStale).length,
    inProgress: activeTasks.filter(t => t.status === 'in_progress').length,
    completed: activeTasks.filter(t => t.status === 'completed').length,
    pending: activeTasks.filter(t => t.status === 'pending').length,
    blocked: activeTasks.filter(t => t.status === 'blocked').length,
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur border-b border-white/8">
        <div className="max-w-screen-2xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold text-white">C</div>
              <div>
                <h1 className="text-sm font-bold text-white leading-tight">Claude Agent Teams</h1>
                <p className="text-xs text-slate-500 leading-tight">Kanban Monitor</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="text-xs bg-slate-800/80 border border-white/8 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 w-40"
              />
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
                  connectionStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
                }`} />
                <span className="text-xs text-slate-400">
                  {connectionStatus === 'connected' ? 'Live' : connectionStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
                </span>
              </div>
              {lastUpdated && (
                <span className="text-xs text-slate-600 hidden md:block">{lastUpdated.toLocaleTimeString()}</span>
              )}
              <button onClick={fetchSessions} className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-white/8 px-3 py-1.5 rounded-lg transition-all">↻</button>
            </div>
          </div>

          {/* Stats + filters */}
          {!loading && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {/* Stats */}
              <div className="flex items-center gap-4">
                <StatBadge label="Sessions" value={stats.activeSessions} color="text-violet-400" />
                <StatBadge label="In Progress" value={stats.inProgress} color="text-blue-400" dot="bg-blue-400" />
                <StatBadge label="Done" value={stats.completed} color="text-emerald-400" dot="bg-emerald-400" />
                <StatBadge label="Pending" value={stats.pending} color="text-slate-400" />
                {stats.blocked > 0 && <StatBadge label="Blocked" value={stats.blocked} color="text-red-400" dot="bg-red-400" />}
                {stats.endedSessions > 0 && (
                  <>
                    <div className="w-px h-4 bg-white/10" />
                    <StatBadge label="Ended" value={stats.endedSessions} color="text-slate-600" />
                  </>
                )}
              </div>

              <div className="w-px h-4 bg-white/10 mx-1" />

              {/* Status filter */}
              <div className="flex items-center gap-1">
                {(['active', 'all', 'ended'] as FilterStatus[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-all capitalize ${filter === f ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                    {f === 'active' ? `Active (${stats.activeSessions})` : f === 'ended' ? `Ended (${stats.endedSessions})` : `All (${sessions.length})`}
                  </button>
                ))}
              </div>

              <div className="w-px h-4 bg-white/10 mx-1" />

              {/* Source filter */}
              <div className="flex items-center gap-1">
                {(['all', 'todos', 'tasks'] as SourceFilter[]).map(s => (
                  <button key={s} onClick={() => setSourceFilter(s)}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-all ${sourceFilter === s ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                    {s === 'all' ? 'All sources' : s === 'todos' ? '📝 TodoWrite' : '🏗 Agent Tasks'}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button onClick={expandAll} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Expand all</button>
                <span className="text-slate-700">·</span>
                <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Collapse all</button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-5">
        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          sessions.length === 0 ? <EmptyState /> : <NoResultsState />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(session => (
              <SessionBoard
                key={session.id}
                session={session}
                isExpanded={expandedSessions.has(session.id)}
                onToggle={() => toggleSession(session.id)}
                searchQuery={q}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatBadge({ label, value, color, dot }: { label: string; value: number; color: string; dot?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">Loading sessions…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-white/8 flex items-center justify-center text-3xl">🤖</div>
      <div>
        <p className="text-white font-semibold mb-1">No sessions found</p>
        <p className="text-slate-400 text-sm max-w-sm">Start a Claude Code session to see tasks here.</p>
        <p className="text-slate-600 text-xs mt-2 font-mono">~/.claude/todos/ · ~/.claude/tasks/</p>
      </div>
    </div>
  );
}

function NoResultsState() {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
      <p className="text-slate-400 text-sm">No sessions match your filter</p>
      <p className="text-slate-600 text-xs">Try changing the filter or search query</p>
    </div>
  );
}
