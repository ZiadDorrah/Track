import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function formatTimeAgo(isoStr) {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  const diffSecs = Math.floor((new Date() - date) / 1000);
  if (diffSecs < 60) return 'just now';
  const mins = Math.floor(diffSecs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Mark as read error:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }
    if (notif.entityType === 'project' && notif.entityId) {
      navigate(`/project/${notif.entityId}`);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-white/5 border border-white/8 hover:bg-white/10 text-white rounded-lg transition-all relative cursor-pointer flex items-center justify-center w-9 h-9"
        title="Notifications"
      >
        <i className="fa-solid fa-bell text-text-secondary hover:text-white text-sm"></i>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-black animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0f1016]/95 border border-white/12 rounded-2xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="p-4 border-b border-white/8 flex justify-between items-center bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-bell text-accent text-xs"></i>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-heading">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-accent/20 text-accent text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-accent hover:underline font-medium cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/4">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted">
                <i className="fa-solid fa-inbox text-2xl opacity-20 mb-2 block"></i>
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 flex gap-3 items-start transition-colors cursor-pointer ${
                    n.isRead ? 'opacity-70 hover:opacity-100 hover:bg-white/[0.02]' : 'bg-accent/5 hover:bg-accent/10'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-accent text-xs mt-0.5">
                    {n.type === 'task_assigned' ? <i className="fa-solid fa-tasks text-blue-400"></i> :
                     n.type === 'task_completed' ? <i className="fa-solid fa-check text-emerald-400"></i> :
                     n.type === 'project_completed' ? <i className="fa-solid fa-flag-checkered text-amber-400"></i> :
                     <i className="fa-solid fa-user-plus text-purple-400"></i>}
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-bold text-white truncate pr-2">{n.title}</h4>
                      <span className="text-[9px] text-text-muted whitespace-nowrap">{formatTimeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5 line-clamp-2">{n.body}</p>
                  </div>

                  {!n.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      title="Mark as read"
                      className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2 hover:scale-150 transition-transform"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
