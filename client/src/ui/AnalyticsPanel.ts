/**
 * AnalyticsPanel.ts
 * Agent activity analytics dashboard for spectators
 */

declare const Chart: any;

export type AnalyticsMetric = 
  | 'messages_sent'
  | 'rooms_visited' 
  | 'trades_completed'
  | 'games_won'
  | 'friends_count';

export type AgentAnalytics = {
  rank: number;
  agentId: string;
  displayName: string;
  value: number;
};

export type TimelinePoint = {
  timestamp: number;
  value: number;
};

export type AgentTimeline = {
  agentId: string;
  displayName: string;
  metric: AnalyticsMetric;
  dataPoints: TimelinePoint[];
};

export class AnalyticsPanel {
  private container!: HTMLElement;
  private currentMetric: AnalyticsMetric = 'messages_sent';
  private barChart: any = null;
  private lineChart: any = null;
  private selectedAgentId: string | null = null;

  public onMetricChange?: (metric: AnalyticsMetric) => void;
  public onAgentSelect?: (agentId: string) => void;

  constructor() {
    this.createUI();
  }

  private createUI(): void {
    const existing = document.getElementById('analytics-panel');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'analytics-panel';
    container.className = 'analytics-panel hidden';
    container.innerHTML = `
      <div class="panel-header">
        <h3>📊 Agent Analytics</h3>
        <button class="panel-close" id="analytics-close">×</button>
      </div>
      
      <div class="panel-tabs">
        <button class="panel-tab active" data-metric="messages_sent" title="Messages sent">
          💬 Messages
        </button>
        <button class="panel-tab" data-metric="rooms_visited" title="Rooms visited">
          🏠 Rooms
        </button>
        <button class="panel-tab" data-metric="trades_completed" title="Trades completed">
          🤝 Trades
        </button>
        <button class="panel-tab" data-metric="games_won" title="Games won">
          🎮 Games
        </button>
        <button class="panel-tab" data-metric="friends_count" title="Friends made">
          👥 Friends
        </button>
      </div>

      <div class="analytics-content">
        <div class="analytics-section">
          <h4>Top Agents</h4>
          <div class="chart-container">
            <canvas id="analytics-bar-chart"></canvas>
          </div>
        </div>

        <div class="analytics-section" id="timeline-section" style="display: none;">
          <h4>Activity Timeline - <span id="timeline-agent-name">Select an agent</span></h4>
          <div class="timeline-controls">
            <button class="timeline-btn" data-hours="1">1h</button>
            <button class="timeline-btn active" data-hours="24">24h</button>
            <button class="timeline-btn" data-hours="168">7d</button>
          </div>
          <div class="chart-container">
            <canvas id="analytics-line-chart"></canvas>
          </div>
        </div>

        <div class="analytics-loading" id="analytics-loading">
          <div class="loading">Loading analytics...</div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    this.attachListeners();
    this.initializeCharts();
  }

  private attachListeners(): void {
    const closeBtn = document.getElementById('analytics-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // Metric tab switching
    const tabs = this.container.querySelectorAll('.panel-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const metric = tab.getAttribute('data-metric') as AnalyticsMetric;
        this.switchMetric(metric);
      });
    });

    // Timeline hour selection
    const timelineBtns = this.container.querySelectorAll('.timeline-btn');
    timelineBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const hours = parseInt(btn.getAttribute('data-hours') || '24');
        
        // Update active state
        timelineBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Reload timeline with new hours
        if (this.selectedAgentId) {
          this.loadTimeline(this.selectedAgentId, hours);
        }
      });
    });
  }

  private initializeCharts(): void {
    const barCanvas = document.getElementById('analytics-bar-chart') as HTMLCanvasElement;
    const lineCanvas = document.getElementById('analytics-line-chart') as HTMLCanvasElement;

    if (!barCanvas || !lineCanvas) {
      console.error('[AnalyticsPanel] Chart canvases not found');
      return;
    }

    // Initialize bar chart
    this.barChart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Value',
          data: [],
          backgroundColor: 'rgba(0, 255, 204, 0.6)',
          borderColor: 'rgba(0, 255, 204, 1)',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        onClick: (event: any, elements: any[]) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const agentId = this.barChart.data.datasets[0].agentIds?.[index];
            if (agentId) {
              this.selectAgent(agentId);
            }
          }
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: 'rgba(10, 10, 26, 0.9)',
            titleColor: '#00ffcc',
            bodyColor: '#e0e0e0',
            borderColor: '#00ffcc',
            borderWidth: 1,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#888',
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)',
            },
          },
          x: {
            ticks: {
              color: '#888',
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)',
            },
          },
        },
      },
    });

    // Initialize line chart
    this.lineChart = new Chart(lineCanvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Activity',
          data: [],
          borderColor: 'rgba(0, 255, 204, 1)',
          backgroundColor: 'rgba(0, 255, 204, 0.1)',
          tension: 0.4,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: 'rgba(10, 10, 26, 0.9)',
            titleColor: '#00ffcc',
            bodyColor: '#e0e0e0',
            borderColor: '#00ffcc',
            borderWidth: 1,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#888',
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)',
            },
          },
          x: {
            ticks: {
              color: '#888',
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)',
            },
          },
        },
      },
    });
  }

  private switchMetric(metric: AnalyticsMetric): void {
    this.currentMetric = metric;

    // Update tab buttons
    const tabs = this.container.querySelectorAll('.panel-tab');
    tabs.forEach(t => {
      const tabMetric = t.getAttribute('data-metric');
      t.classList.toggle('active', tabMetric === metric);
    });

    // Clear selection
    this.selectedAgentId = null;
    this.hideTimeline();

    // Trigger callback to load new data
    this.onMetricChange?.(metric);
  }

  private selectAgent(agentId: string): void {
    this.selectedAgentId = agentId;
    const hours = parseInt(
      document.querySelector('.timeline-btn.active')?.getAttribute('data-hours') || '24'
    );
    this.loadTimeline(agentId, hours);
    this.showTimeline();
  }

  private async loadTimeline(agentId: string, hours: number): Promise<void> {
    try {
      const response = await fetch(
        `/api/analytics/agents/${agentId}/timeline?metric=${this.currentMetric}&hours=${hours}`
      );

      if (!response.ok) {
        throw new Error('Failed to load timeline');
      }

      const timeline: AgentTimeline = await response.json();
      this.renderTimeline(timeline);
    } catch (error) {
      console.error('[AnalyticsPanel] Error loading timeline:', error);
      this.showError('Failed to load timeline data');
    }
  }

  public show(): void {
    this.container.classList.remove('hidden');
  }

  public hide(): void {
    this.container.classList.add('hidden');
  }

  public toggle(): void {
    this.container.classList.toggle('hidden');
  }

  public showLoading(): void {
    const loading = document.getElementById('analytics-loading');
    if (loading) {
      loading.style.display = 'block';
    }
  }

  public hideLoading(): void {
    const loading = document.getElementById('analytics-loading');
    if (loading) {
      loading.style.display = 'none';
    }
  }

  private showTimeline(): void {
    const section = document.getElementById('timeline-section');
    if (section) {
      section.style.display = 'block';
    }
  }

  private hideTimeline(): void {
    const section = document.getElementById('timeline-section');
    if (section) {
      section.style.display = 'none';
    }
  }

  public setTopAgents(agents: AgentAnalytics[]): void {
    if (!this.barChart) return;

    const labels = agents.map(a => a.displayName);
    const values = agents.map(a => a.value);
    const agentIds = agents.map(a => a.agentId);

    this.barChart.data.labels = labels;
    this.barChart.data.datasets[0].data = values;
    this.barChart.data.datasets[0].agentIds = agentIds;
    this.barChart.data.datasets[0].label = this.getMetricLabel(this.currentMetric);
    this.barChart.update();

    this.hideLoading();
  }

  private renderTimeline(timeline: AgentTimeline): void {
    if (!this.lineChart) return;

    // Update agent name
    const nameEl = document.getElementById('timeline-agent-name');
    if (nameEl) {
      nameEl.textContent = timeline.displayName;
    }

    // Prepare data
    const labels = timeline.dataPoints.map(p => new Date(p.timestamp).toLocaleTimeString());
    const values = timeline.dataPoints.map(p => p.value);

    this.lineChart.data.labels = labels;
    this.lineChart.data.datasets[0].data = values;
    this.lineChart.data.datasets[0].label = this.getMetricLabel(timeline.metric);
    this.lineChart.update();
  }

  private getMetricLabel(metric: AnalyticsMetric): string {
    const labels: Record<AnalyticsMetric, string> = {
      messages_sent: 'Messages Sent',
      rooms_visited: 'Rooms Visited',
      trades_completed: 'Trades Completed',
      games_won: 'Games Won',
      friends_count: 'Friends Made',
    };
    return labels[metric] || metric;
  }

  private showError(message: string): void {
    const loading = document.getElementById('analytics-loading');
    if (loading) {
      loading.innerHTML = `<div class="error">${this.escapeHtml(message)}</div>`;
      loading.style.display = 'block';
    }
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public getCurrentMetric(): AnalyticsMetric {
    return this.currentMetric;
  }
}
