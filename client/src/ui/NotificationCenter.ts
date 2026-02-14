/**
 * NotificationCenter.ts
 * Unified notification center with bell icon and dropdown list
 */

export type Notification = {
  id: number;
  type: 'friend_request' | 'trade_offer' | 'whisper' | 'achievement' | 'system';
  title: string;
  message: string;
  link?: string;
  read_at?: number;
  created_at: number;
};

export class NotificationCenter {
  private container: HTMLDivElement;
  private bellButton: HTMLButtonElement;
  private badge: HTMLSpanElement;
  private dropdown: HTMLDivElement;
  private notificationsList: HTMLDivElement;
  private notifications: Notification[] = [];
  private unreadCount = 0;
  private isOpen = false;
  private onNavigate?: (url: string) => void;

  constructor(parent: HTMLElement, onNavigate?: (url: string) => void) {
    this.onNavigate = onNavigate;

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'notification-center';

    // Create bell button
    this.bellButton = document.createElement('button');
    this.bellButton.className = 'notification-bell';
    this.bellButton.textContent = '🔔';
    this.bellButton.addEventListener('click', () => this.toggle());

    // Create unread badge
    this.badge = document.createElement('span');
    this.badge.className = 'notification-badge';
    this.badge.style.display = 'none';

    // Create dropdown
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'notification-dropdown';
    this.dropdown.style.display = 'none';

    // Header
    const header = document.createElement('div');
    header.className = 'notification-header';
    header.innerHTML = `
      <h3>Notifications</h3>
      <button class="mark-all-read">Mark all read</button>
    `;
    header.querySelector('.mark-all-read')?.addEventListener('click', () => this.markAllAsRead());

    // Notifications list
    this.notificationsList = document.createElement('div');
    this.notificationsList.className = 'notifications-list';
    this.notificationsList.innerHTML = '<div class="empty-state">No notifications</div>';

    this.dropdown.appendChild(header);
    this.dropdown.appendChild(this.notificationsList);

    this.bellButton.appendChild(this.badge);
    this.container.appendChild(this.bellButton);
    this.container.appendChild(this.dropdown);

    parent.appendChild(this.container);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target as Node)) {
        this.close();
      }
    });

    // Fetch initial notifications
    this.fetchNotifications();
  }

  /**
   * Toggle dropdown visibility
   */
  toggle() {
    this.isOpen = !this.isOpen;
    this.dropdown.style.display = this.isOpen ? 'block' : 'none';
  }

  /**
   * Close dropdown
   */
  close() {
    this.isOpen = false;
    this.dropdown.style.display = 'none';
  }

  /**
   * Fetch notifications from API
   */
  async fetchNotifications() {
    try {
      const res = await fetch('/api/notifications/unread');
      if (!res.ok) throw new Error('Failed to fetch notifications');

      const data = await res.json();
      this.notifications = data.notifications || [];
      this.unreadCount = data.unreadCount || 0;

      this.render();
    } catch (error) {
      console.error('[NotificationCenter] Failed to fetch notifications:', error);
    }
  }

  /**
   * Add a new notification (real-time via WebSocket)
   */
  addNotification(notification: Notification, unreadCount: number) {
    // Add to front of list
    this.notifications.unshift(notification);
    this.unreadCount = unreadCount;

    this.render();

    // Show brief flash animation on bell
    this.bellButton.classList.add('notification-flash');
    setTimeout(() => this.bellButton.classList.remove('notification-flash'), 300);
  }

  /**
   * Render notifications list
   */
  render() {
    // Update badge
    if (this.unreadCount > 0) {
      this.badge.textContent = this.unreadCount > 99 ? '99+' : String(this.unreadCount);
      this.badge.style.display = 'block';
    } else {
      this.badge.style.display = 'none';
    }

    // Render notifications
    if (this.notifications.length === 0) {
      this.notificationsList.innerHTML = '<div class="empty-state">No notifications</div>';
      return;
    }

    this.notificationsList.innerHTML = '';

    for (const notif of this.notifications) {
      const item = document.createElement('div');
      item.className = 'notification-item';
      if (!notif.read_at) {
        item.classList.add('unread');
      }

      const icon = this.getIcon(notif.type);
      const timeAgo = this.formatTimeAgo(notif.created_at);

      item.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
          <div class="notification-title">${this.escapeHtml(notif.title)}</div>
          <div class="notification-message">${this.escapeHtml(notif.message)}</div>
          <div class="notification-time">${timeAgo}</div>
        </div>
        <button class="notification-delete" data-id="${notif.id}" aria-label="Delete">✕</button>
      `;

      // Click notification to navigate (if has link)
      item.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('notification-delete')) {
          await this.deleteNotification(notif.id);
          return;
        }

        // Mark as read
        if (!notif.read_at) {
          await this.markAsRead(notif.id);
        }

        // Navigate if link exists
        if (notif.link && this.onNavigate) {
          this.onNavigate(notif.link);
          this.close();
        }
      });

      this.notificationsList.appendChild(item);
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: number) {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      if (!res.ok) throw new Error('Failed to mark as read');

      // Update local state
      const notif = this.notifications.find((n) => n.id === id);
      if (notif && !notif.read_at) {
        notif.read_at = Math.floor(Date.now() / 1000);
        this.unreadCount = Math.max(0, this.unreadCount - 1);
        this.render();
      }
    } catch (error) {
      console.error('[NotificationCenter] Failed to mark as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'PUT' });
      if (!res.ok) throw new Error('Failed to mark all as read');

      // Update local state
      const now = Math.floor(Date.now() / 1000);
      for (const notif of this.notifications) {
        notif.read_at = now;
      }
      this.unreadCount = 0;

      this.render();
    } catch (error) {
      console.error('[NotificationCenter] Failed to mark all as read:', error);
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(id: number) {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete notification');

      // Update local state
      const index = this.notifications.findIndex((n) => n.id === id);
      if (index !== -1) {
        const wasUnread = !this.notifications[index].read_at;
        this.notifications.splice(index, 1);
        if (wasUnread) {
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        }
        this.render();
      }
    } catch (error) {
      console.error('[NotificationCenter] Failed to delete notification:', error);
    }
  }

  /**
   * Get icon for notification type
   */
  getIcon(type: string): string {
    const icons: Record<string, string> = {
      friend_request: '👋',
      trade_offer: '💱',
      whisper: '💬',
      achievement: '🏆',
      system: '📢',
    };
    return icons[type] || '📬';
  }

  /**
   * Format timestamp as "time ago"
   */
  formatTimeAgo(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy notification center
   */
  destroy() {
    this.container.remove();
  }
}
