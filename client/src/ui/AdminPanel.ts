/**
 * AdminPanel.ts
 * Admin dashboard for moderators and administrators
 */

export type Agent = {
  id: string;
  display_name: string;
  role: 'user' | 'moderator' | 'admin';
  created_at: string;
  banned: boolean;
  ban_reason?: string;
};

export type Room = {
  id: string;
  name: string;
  slug: string;
  owner_name: string;
  occupant_count: number;
  created_at: string;
};

export type ModerationLog = {
  id: number;
  action: string;
  moderator_name: string;
  target_name: string;
  reason?: string;
  created_at: string;
};

export class AdminPanel {
  private container!: HTMLElement;
  private currentTab: 'users' | 'rooms' | 'moderation' | 'tools' = 'users';
  private agents: Agent[] = [];
  private rooms: Room[] = [];
  private logs: ModerationLog[] = [];
  private wordFilters: any[] = [];
  private token: string = '';

  public onKickAgent?: (agentId: string, reason: string) => void;
  public onBanAgent?: (agentId: string, reason: string) => void;
  public onChangeRole?: (agentId: string, role: string) => void;
  public onDeleteRoom?: (roomId: string) => void;

  constructor(token: string) {
    this.token = token;
    this.createUI();
  }

  private createUI(): void {
    const existing = document.getElementById('admin-panel');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'admin-panel';
    container.className = 'admin-panel hidden';
    container.innerHTML = `
      <div class="panel-header">
        <h3>Admin Dashboard</h3>
        <button class="panel-close" id="admin-close">×</button>
      </div>
      
      <div class="panel-tabs">
        <button class="panel-tab active" data-admin-tab="users">Users</button>
        <button class="panel-tab" data-admin-tab="rooms">Rooms</button>
        <button class="panel-tab" data-admin-tab="moderation">Logs</button>
        <button class="panel-tab" data-admin-tab="tools">Tools</button>
      </div>

      <div class="admin-content">
        <!-- Users Tab -->
        <div class="tab-content active" id="users-tab">
          <div class="admin-table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="users-table-body">
                <tr><td colspan="5">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Rooms Tab -->
        <div class="tab-content" id="rooms-tab">
          <div class="admin-table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Occupants</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="rooms-table-body">
                <tr><td colspan="5">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Moderation Logs Tab -->
        <div class="tab-content" id="moderation-tab">
          <div class="admin-table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Moderator</th>
                  <th>Target</th>
                  <th>Reason</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody id="logs-table-body">
                <tr><td colspan="5">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Moderation Tools Tab -->
        <div class="tab-content" id="tools-tab">
          <div class="tools-sections">
            <!-- Mute Agent Section -->
            <div class="tool-section">
              <h4>Mute Agent</h4>
              <div class="tool-form">
                <input type="text" id="mute-agent-id" placeholder="Agent ID" />
                <input type="number" id="mute-duration" placeholder="Duration (minutes)" min="1" value="30" />
                <input type="text" id="mute-reason" placeholder="Reason" />
                <button id="btn-mute-agent" class="btn-primary">Mute</button>
                <button id="btn-unmute-agent" class="btn-secondary">Unmute</button>
              </div>
            </div>

            <!-- Word Filters Section -->
            <div class="tool-section">
              <h4>Word Filters</h4>
              <div class="tool-form">
                <input type="text" id="filter-pattern" placeholder="Regex pattern (e.g. badword|spam)" />
                <select id="filter-severity">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <select id="filter-action">
                  <option value="flag">Flag</option>
                  <option value="block">Block</option>
                  <option value="auto_mute">Auto-Mute</option>
                </select>
                <input type="number" id="filter-mute-duration" placeholder="Auto-mute minutes" min="1" value="60" />
                <button id="btn-add-filter" class="btn-primary">Add Filter</button>
              </div>
              <div class="admin-table-container">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Pattern</th>
                      <th>Severity</th>
                      <th>Action</th>
                      <th>Mute Duration</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="filters-table-body">
                    <tr><td colspan="5">Loading...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- IP Ban Section -->
            <div class="tool-section">
              <h4>IP Ban</h4>
              <div class="tool-form">
                <input type="text" id="ip-address" placeholder="IP Address (e.g. 192.168.1.1)" />
                <input type="number" id="ip-ban-duration" placeholder="Duration (minutes, 0=permanent)" min="0" value="1440" />
                <input type="text" id="ip-ban-reason" placeholder="Reason" />
                <button id="btn-ban-ip" class="btn-danger">Ban IP</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    this.attachListeners();
  }

  private attachListeners(): void {
    // Close button
    this.container.querySelector('#admin-close')?.addEventListener('click', () => {
      this.hide();
    });

    // Tab switching
    this.container.querySelectorAll('[data-admin-tab]').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = (e.currentTarget as HTMLElement).dataset.adminTab as 'users' | 'rooms' | 'moderation';
        this.switchTab(target);
      });
    });
  }

  private switchTab(tab: 'users' | 'rooms' | 'moderation' | 'tools'): void {
    this.currentTab = tab;

    // Update tab buttons
    this.container.querySelectorAll('.panel-tab').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.adminTab === tab);
    });

    // Update content visibility
    this.container.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });
    this.container.querySelector(`#${tab}-tab`)?.classList.add('active');

    // Load data for the selected tab
    if (tab === 'users') this.loadAgents();
    else if (tab === 'rooms') this.loadRooms();
    else if (tab === 'moderation') this.loadLogs();
    else if (tab === 'tools') this.loadTools();
  }

  public async loadAgents(): Promise<void> {
    try {
      const response = await fetch('/api/admin/agents', {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!response.ok) throw new Error('Failed to load agents');

      const data = await response.json();
      this.agents = data.agents;
      this.renderAgents();
    } catch (error) {
      console.error('Failed to load agents:', error);
      this.renderError('users-table-body', 'Failed to load users');
    }
  }

  private renderAgents(): void {
    const tbody = this.container.querySelector('#users-table-body');
    if (!tbody) return;

    if (this.agents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No users found</td></tr>';
      return;
    }

    tbody.innerHTML = this.agents
      .map(
        (agent) => `
        <tr>
          <td>${this.escapeHtml(agent.display_name)}</td>
          <td>
            <select class="role-select" data-agent-id="${agent.id}">
              <option value="user" ${agent.role === 'user' ? 'selected' : ''}>User</option>
              <option value="moderator" ${agent.role === 'moderator' ? 'selected' : ''}>Moderator</option>
              <option value="admin" ${agent.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </td>
          <td>${new Date(agent.created_at).toLocaleDateString()}</td>
          <td>${agent.banned ? '<span class="status-banned">Banned</span>' : '<span class="status-active">Active</span>'}</td>
          <td>
            <button class="btn-kick" data-agent-id="${agent.id}">Kick</button>
            <button class="btn-ban" data-agent-id="${agent.id}" ${agent.banned ? 'disabled' : ''}>Ban</button>
          </td>
        </tr>
      `
      )
      .join('');

    // Attach event listeners
    tbody.querySelectorAll('.role-select').forEach((select) => {
      select.addEventListener('change', (e) => {
        const agentId = (e.target as HTMLElement).dataset.agentId!;
        const newRole = (e.target as HTMLSelectElement).value;
        this.changeRole(agentId, newRole);
      });
    });

    tbody.querySelectorAll('.btn-kick').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const agentId = (e.target as HTMLElement).dataset.agentId!;
        this.kickAgent(agentId);
      });
    });

    tbody.querySelectorAll('.btn-ban').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const agentId = (e.target as HTMLElement).dataset.agentId!;
        this.banAgent(agentId);
      });
    });
  }

  public async loadRooms(): Promise<void> {
    try {
      const response = await fetch('/api/admin/rooms', {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!response.ok) throw new Error('Failed to load rooms');

      const data = await response.json();
      this.rooms = data.rooms;
      this.renderRooms();
    } catch (error) {
      console.error('Failed to load rooms:', error);
      this.renderError('rooms-table-body', 'Failed to load rooms');
    }
  }

  private renderRooms(): void {
    const tbody = this.container.querySelector('#rooms-table-body');
    if (!tbody) return;

    if (this.rooms.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No rooms found</td></tr>';
      return;
    }

    tbody.innerHTML = this.rooms
      .map(
        (room) => `
        <tr>
          <td>${this.escapeHtml(room.name)}</td>
          <td>${this.escapeHtml(room.owner_name || 'Unknown')}</td>
          <td>${room.occupant_count}</td>
          <td>${new Date(room.created_at).toLocaleDateString()}</td>
          <td>
            <button class="btn-delete-room" data-room-id="${room.id}">Delete</button>
          </td>
        </tr>
      `
      )
      .join('');

    // Attach event listeners
    tbody.querySelectorAll('.btn-delete-room').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const roomId = (e.target as HTMLElement).dataset.roomId!;
        this.deleteRoom(roomId);
      });
    });
  }

  public async loadLogs(): Promise<void> {
    try {
      const response = await fetch('/api/admin/logs?limit=50', {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!response.ok) throw new Error('Failed to load logs');

      const data = await response.json();
      this.logs = data.logs;
      this.renderLogs();
    } catch (error) {
      console.error('Failed to load logs:', error);
      this.renderError('logs-table-body', 'Failed to load logs');
    }
  }

  private renderLogs(): void {
    const tbody = this.container.querySelector('#logs-table-body');
    if (!tbody) return;

    if (this.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No logs found</td></tr>';
      return;
    }

    tbody.innerHTML = this.logs
      .map(
        (log) => `
        <tr>
          <td>${this.escapeHtml(log.action)}</td>
          <td>${this.escapeHtml(log.moderator_name || 'System')}</td>
          <td>${this.escapeHtml(log.target_name || '-')}</td>
          <td>${this.escapeHtml(log.reason || '-')}</td>
          <td>${new Date(log.created_at).toLocaleString()}</td>
        </tr>
      `
      )
      .join('');
  }

  private async changeRole(agentId: string, newRole: string): Promise<void> {
    try {
      const response = await fetch(`/api/admin/agents/${agentId}/role`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) throw new Error('Failed to change role');

      if (this.onChangeRole) this.onChangeRole(agentId, newRole);
      await this.loadAgents(); // Reload to reflect changes
    } catch (error) {
      console.error('Failed to change role:', error);
      alert('Failed to change role');
      await this.loadAgents(); // Reload to reset UI
    }
  }

  private async kickAgent(agentId: string): Promise<void> {
    const reason = prompt('Reason for kick:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/admin/agents/${agentId}/kick`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) throw new Error('Failed to kick agent');

      if (this.onKickAgent) this.onKickAgent(agentId, reason);
      alert('Agent kicked successfully');
    } catch (error) {
      console.error('Failed to kick agent:', error);
      alert('Failed to kick agent');
    }
  }

  private async banAgent(agentId: string): Promise<void> {
    const reason = prompt('Reason for ban:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/admin/agents/${agentId}/ban`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) throw new Error('Failed to ban agent');

      if (this.onBanAgent) this.onBanAgent(agentId, reason);
      await this.loadAgents(); // Reload to reflect changes
    } catch (error) {
      console.error('Failed to ban agent:', error);
      alert('Failed to ban agent');
    }
  }

  private async deleteRoom(roomId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this room?')) return;

    try {
      const response = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!response.ok) throw new Error('Failed to delete room');

      if (this.onDeleteRoom) this.onDeleteRoom(roomId);
      await this.loadRooms(); // Reload to reflect changes
    } catch (error) {
      console.error('Failed to delete room:', error);
      alert('Failed to delete room');
    }
  }

  private renderError(tbodyId: string, message: string): void {
    const tbody = this.container.querySelector(`#${tbodyId}`);
    if (tbody) {
      const colspan = tbodyId === 'users-table-body' ? 5 : 5;
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="error">${this.escapeHtml(message)}</td></tr>`;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  public show(): void {
    this.container.classList.remove('hidden');
    this.loadAgents(); // Load initial data
  }

  public hide(): void {
    this.container.classList.add('hidden');
  }

  public toggle(): void {
    if (this.container.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }

  // === MODERATION TOOLS METHODS ===

  private loadTools(): void {
    this.loadWordFilters();
    this.attachToolsListeners();
  }

  private attachToolsListeners(): void {
    // Mute agent
    this.container.querySelector('#btn-mute-agent')?.addEventListener('click', async () => {
      const agentId = (this.container.querySelector('#mute-agent-id') as HTMLInputElement)?.value;
      const duration = parseInt((this.container.querySelector('#mute-duration') as HTMLInputElement)?.value || '30');
      const reason = (this.container.querySelector('#mute-reason') as HTMLInputElement)?.value;

      if (!agentId) {
        alert('Please enter an agent ID');
        return;
      }

      await this.muteAgent(agentId, duration, reason);
    });

    // Unmute agent
    this.container.querySelector('#btn-unmute-agent')?.addEventListener('click', async () => {
      const agentId = (this.container.querySelector('#mute-agent-id') as HTMLInputElement)?.value;

      if (!agentId) {
        alert('Please enter an agent ID');
        return;
      }

      await this.unmuteAgent(agentId);
    });

    // Add word filter
    this.container.querySelector('#btn-add-filter')?.addEventListener('click', async () => {
      const pattern = (this.container.querySelector('#filter-pattern') as HTMLInputElement)?.value;
      const severity = (this.container.querySelector('#filter-severity') as HTMLSelectElement)?.value;
      const action = (this.container.querySelector('#filter-action') as HTMLSelectElement)?.value;
      const muteDuration = parseInt(
        (this.container.querySelector('#filter-mute-duration') as HTMLInputElement)?.value || '60'
      );

      if (!pattern) {
        alert('Please enter a pattern');
        return;
      }

      await this.addWordFilter(pattern, severity, action, action === 'auto_mute' ? muteDuration : null);
    });

    // Ban IP
    this.container.querySelector('#btn-ban-ip')?.addEventListener('click', async () => {
      const ipAddress = (this.container.querySelector('#ip-address') as HTMLInputElement)?.value;
      const duration = parseInt((this.container.querySelector('#ip-ban-duration') as HTMLInputElement)?.value || '1440');
      const reason = (this.container.querySelector('#ip-ban-reason') as HTMLInputElement)?.value;

      if (!ipAddress) {
        alert('Please enter an IP address');
        return;
      }

      await this.banIP(ipAddress, duration === 0 ? null : duration, reason);
    });
  }

  private async muteAgent(agentId: string, durationMinutes: number, reason: string): Promise<void> {
    try {
      const response = await fetch('/api/moderation/mute', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId, durationMinutes, reason }),
      });

      if (!response.ok) throw new Error('Failed to mute agent');

      alert(`Agent ${agentId} muted for ${durationMinutes} minutes`);
      (this.container.querySelector('#mute-agent-id') as HTMLInputElement).value = '';
      (this.container.querySelector('#mute-reason') as HTMLInputElement).value = '';
    } catch (error) {
      console.error('Failed to mute agent:', error);
      alert('Failed to mute agent');
    }
  }

  private async unmuteAgent(agentId: string): Promise<void> {
    try {
      const response = await fetch('/api/moderation/unmute', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId }),
      });

      if (!response.ok) throw new Error('Failed to unmute agent');

      alert(`Agent ${agentId} unmuted`);
      (this.container.querySelector('#mute-agent-id') as HTMLInputElement).value = '';
    } catch (error) {
      console.error('Failed to unmute agent:', error);
      alert('Failed to unmute agent');
    }
  }

  private async addWordFilter(
    pattern: string,
    severity: string,
    action: string,
    autoMuteDurationMinutes: number | null
  ): Promise<void> {
    try {
      const response = await fetch('/api/moderation/filter', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pattern, severity, action, autoMuteDurationMinutes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add filter');
      }

      alert('Word filter added successfully');
      (this.container.querySelector('#filter-pattern') as HTMLInputElement).value = '';
      await this.loadWordFilters();
    } catch (error) {
      console.error('Failed to add filter:', error);
      alert((error as Error).message);
    }
  }

  private async deleteWordFilter(filterId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this filter?')) return;

    try {
      const response = await fetch(`/api/moderation/filter/${filterId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!response.ok) throw new Error('Failed to delete filter');

      await this.loadWordFilters();
    } catch (error) {
      console.error('Failed to delete filter:', error);
      alert('Failed to delete filter');
    }
  }

  private async banIP(ipAddress: string, durationMinutes: number | null, reason: string): Promise<void> {
    try {
      const response = await fetch('/api/moderation/ip-ban', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ipAddress, durationMinutes, reason }),
      });

      if (!response.ok) throw new Error('Failed to ban IP');

      alert(`IP ${ipAddress} banned ${durationMinutes ? `for ${durationMinutes} minutes` : 'permanently'}`);
      (this.container.querySelector('#ip-address') as HTMLInputElement).value = '';
      (this.container.querySelector('#ip-ban-reason') as HTMLInputElement).value = '';
    } catch (error) {
      console.error('Failed to ban IP:', error);
      alert('Failed to ban IP');
    }
  }

  private async loadWordFilters(): Promise<void> {
    try {
      const response = await fetch('/api/moderation/filters', {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!response.ok) throw new Error('Failed to load word filters');

      const data = await response.json();
      this.wordFilters = data.filters;
      this.renderWordFilters();
    } catch (error) {
      console.error('Failed to load word filters:', error);
      this.renderError('filters-table-body', 'Failed to load filters');
    }
  }

  private renderWordFilters(): void {
    const tbody = this.container.querySelector('#filters-table-body');
    if (!tbody) return;

    if (this.wordFilters.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No filters found</td></tr>';
      return;
    }

    tbody.innerHTML = this.wordFilters
      .map(
        (filter) => `
        <tr>
          <td><code>${this.escapeHtml(filter.pattern)}</code></td>
          <td><span class="severity-${filter.severity}">${filter.severity}</span></td>
          <td>${filter.action}</td>
          <td>${filter.auto_mute_duration_minutes || '-'}</td>
          <td>
            <button class="btn-delete-filter" data-filter-id="${filter.id}">Delete</button>
          </td>
        </tr>
      `
      )
      .join('');

    // Attach delete listeners
    tbody.querySelectorAll('.btn-delete-filter').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const filterId = (e.target as HTMLElement).dataset.filterId!;
        this.deleteWordFilter(filterId);
      });
    });
  }
}
