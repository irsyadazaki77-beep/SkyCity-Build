import React from 'react';
import { X, Bell, Check, Trash, Landmark, Zap, Shield, Flame, HeartPulse, GraduationCap, Trophy, Radio, Car, Users, Milestone } from 'lucide-react';

export interface NotificationItem {
  id: string;
  type: 'economy' | 'utilities' | 'traffic' | 'population' | 'crime' | 'fire' | 'health' | 'education' | 'milestone' | 'event' | 'mission';
  title: string;
  message: string;
  timestamp: string; // e.g. "Day 15"
  unread: boolean;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onClearHistory: () => void;
}

export function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onClearHistory,
}: NotificationCenterProps) {
  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => n.unread).length;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'economy': return <Landmark className="text-amber-400" size={16} />;
      case 'utilities': return <Zap className="text-cyan-400" size={16} />;
      case 'traffic': return <Car className="text-blue-400" size={16} />;
      case 'population': return <Users className="text-teal-400" size={16} />;
      case 'crime': return <Shield className="text-purple-400" size={16} />;
      case 'fire': return <Flame className="text-red-400" size={16} />;
      case 'health': return <HeartPulse className="text-rose-400" size={16} />;
      case 'education': return <GraduationCap className="text-indigo-400" size={16} />;
      case 'milestone': return <Milestone className="text-emerald-400" size={16} />;
      case 'event': return <Radio className="text-orange-400" size={16} />;
      case 'mission': return <Trophy className="text-yellow-400" size={16} />;
      default: return <Bell className="text-gray-400" size={16} />;
    }
  };

  return (
    <div className="fixed sm:absolute top-[calc(env(safe-area-inset-top,0px)+3.75rem)] right-2 left-2 sm:left-auto sm:right-6 w-auto sm:w-88 max-h-[70vh] bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200 text-gray-200 z-45">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-blue-400 animate-pulse" />
          <span className="font-bold text-sm text-white font-mono">Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white font-mono font-bold text-[10px] px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <button 
          onClick={onClose} 
          className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label="Close Notifications"
        >
          <X size={16} />
        </button>
      </div>

      {/* Quick Actions */}
      {notifications.length > 0 && (
        <div className="flex justify-between items-center text-[10px] font-semibold text-gray-400">
          <button onClick={onMarkAllRead} className="flex items-center gap-1 hover:text-white transition-colors">
            <Check size={12} />
            <span>Mark all read</span>
          </button>
          <button onClick={onClearHistory} className="flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors">
            <Trash size={11} />
            <span>Clear history</span>
          </button>
        </div>
      )}

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-none">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <Bell size={28} className="text-gray-600" />
            <p className="text-xs text-gray-400">Your city is quiet. No notifications yet.</p>
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              className={`p-2.5 rounded-xl border flex gap-3 transition-all ${
                item.unread
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-black/20 border-white/5 opacity-80'
              }`}
            >
              <div className="shrink-0 p-1.5 rounded-lg bg-black/40 flex items-center justify-center self-start mt-0.5">
                {getIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-1">
                  <h4 className={`text-xs font-bold leading-tight truncate ${item.unread ? 'text-white' : 'text-gray-300'}`}>
                    {item.title}
                  </h4>
                  <span className="text-[9px] font-mono font-medium text-gray-500 shrink-0 mt-0.5">
                    {item.timestamp}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 leading-normal mt-1 break-words">
                  {item.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
