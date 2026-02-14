/**
 * ToastManager.ts
 * Toast notification system for in-game events
 */

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

export class ToastManager {
  private container: HTMLDivElement;
  private toasts: Map<string, HTMLDivElement> = new Map();
  private nextId: number = 0;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);

    this.injectStyles();
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .toast-container {
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
      }

      .toast {
        min-width: 280px;
        max-width: 400px;
        padding: 14px 18px;
        border-radius: 8px;
        background: rgba(20, 20, 30, 0.95);
        border-left: 4px solid;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        gap: 12px;
        pointer-events: auto;
        animation: toast-slide-in 0.3s ease-out;
        transition: opacity 0.3s ease, transform 0.3s ease;
      }

      .toast.toast-exit {
        animation: toast-slide-out 0.3s ease-in forwards;
      }

      @keyframes toast-slide-in {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes toast-slide-out {
        from {
          transform: translateX(0) scale(1);
          opacity: 1;
        }
        to {
          transform: translateX(400px) scale(0.9);
          opacity: 0;
        }
      }

      .toast-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      .toast-message {
        flex: 1;
        color: #ffffff;
        font-size: 14px;
        line-height: 1.4;
        word-wrap: break-word;
      }

      .toast.toast-info {
        border-left-color: #3b82f6;
      }

      .toast.toast-success {
        border-left-color: #10b981;
      }

      .toast.toast-warning {
        border-left-color: #f59e0b;
      }

      .toast.toast-error {
        border-left-color: #ef4444;
      }

      @media (max-width: 768px) {
        .toast-container {
          top: 60px;
          right: 10px;
          left: 10px;
        }

        .toast {
          min-width: unset;
          max-width: unset;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show a toast notification
   */
  public show(message: string, type: ToastType = 'info', duration: number = 4000): string {
    const id = `toast-${this.nextId++}`;
    
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;
    toastEl.innerHTML = `
      <span class="toast-icon">${this.getIcon(type)}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
    `;

    this.container.appendChild(toastEl);
    this.toasts.set(id, toastEl);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  /**
   * Dismiss a specific toast by ID
   */
  public dismiss(id: string): void {
    const toastEl = this.toasts.get(id);
    if (!toastEl) return;

    toastEl.classList.add('toast-exit');

    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
      this.toasts.delete(id);
    }, 300); // Match animation duration
  }

  /**
   * Dismiss all active toasts
   */
  public dismissAll(): void {
    const ids = Array.from(this.toasts.keys());
    ids.forEach(id => this.dismiss(id));
  }

  /**
   * Shorthand methods for different toast types
   */
  public info(message: string, duration?: number): string {
    return this.show(message, 'info', duration);
  }

  public success(message: string, duration?: number): string {
    return this.show(message, 'success', duration);
  }

  public warning(message: string, duration?: number): string {
    return this.show(message, 'warning', duration);
  }

  public error(message: string, duration?: number): string {
    return this.show(message, 'error', duration);
  }

  private getIcon(type: ToastType): string {
    const icons: Record<ToastType, string> = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };
    return icons[type];
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Singleton instance
export const toastManager = new ToastManager();
