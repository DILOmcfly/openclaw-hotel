/**
 * LoadingScreen.ts
 * Full-screen loading overlay with progress bar and fade-out animation
 */

export class LoadingScreen {
  private container: HTMLDivElement;
  private progressBar: HTMLDivElement;
  private progressText: HTMLSpanElement;
  private isVisible: boolean = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'loading-screen';
    this.container.className = 'loading-screen';
    this.container.innerHTML = `
      <div class="loading-content">
        <h1 class="loading-logo">OpenClaw Hotel</h1>
        <p class="loading-subtitle">Loading pixel art assets...</p>
        <div class="loading-bar-container">
          <div class="loading-bar" id="loading-bar"></div>
        </div>
        <span class="loading-progress" id="loading-progress">0%</span>
      </div>
    `;

    this.progressBar = this.container.querySelector('#loading-bar') as HTMLDivElement;
    this.progressText = this.container.querySelector('#loading-progress') as HTMLSpanElement;

    // Add styles dynamically
    this.injectStyles();
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .loading-screen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 1;
        transition: opacity 0.5s ease-out;
      }

      .loading-screen.fade-out {
        opacity: 0;
        pointer-events: none;
      }

      .loading-content {
        text-align: center;
        max-width: 500px;
        padding: 2rem;
      }

      .loading-logo {
        font-size: 3rem;
        font-weight: bold;
        color: #e94560;
        margin: 0 0 1rem 0;
        text-shadow: 0 0 20px rgba(233, 69, 96, 0.5);
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      .loading-subtitle {
        font-size: 1.2rem;
        color: #a8a8a8;
        margin: 0 0 2rem 0;
      }

      .loading-bar-container {
        width: 100%;
        height: 12px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        overflow: hidden;
        margin-bottom: 1rem;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .loading-bar {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #e94560, #ff6b9d);
        transition: width 0.3s ease;
        box-shadow: 0 0 10px rgba(233, 69, 96, 0.6);
      }

      .loading-progress {
        font-size: 1rem;
        color: #ffffff;
        font-family: monospace;
        font-weight: bold;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show loading screen
   */
  public show(): void {
    if (this.isVisible) return;
    
    document.body.appendChild(this.container);
    this.isVisible = true;
    this.setProgress(0);
  }

  /**
   * Update progress (0-100)
   */
  public setProgress(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    this.progressBar.style.width = `${clamped}%`;
    this.progressText.textContent = `${Math.round(clamped)}%`;
  }

  /**
   * Hide loading screen with fade-out animation
   */
  public hide(): void {
    if (!this.isVisible) return;

    this.container.classList.add('fade-out');
    
    // Remove from DOM after fade completes
    setTimeout(() => {
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.isVisible = false;
    }, 500); // Match CSS transition duration
  }

  /**
   * Get current visibility state
   */
  public isShowing(): boolean {
    return this.isVisible;
  }
}
