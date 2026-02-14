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
  private currentTab: 'users' | 'rooms' | 'moderation' = 'users';
  private agents: Agent[] = [];
  private rooms: Room[] = [];
  private logs: ModerationLog[] = [];
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

  private switchTab(tab: 'users' | 'rooms' | 'moderation'): void {
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
}
