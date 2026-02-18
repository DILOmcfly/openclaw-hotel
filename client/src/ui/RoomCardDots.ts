/**
 * RoomCardDots — T-354
 * Renders small animated colored dots in room cards representing current agents.
 * Each agent gets a deterministic color based on their ID.
 * Pure utility functions for easy unit testing.
 */

export interface AgentPreview {
  id: string;
  displayName: string;
}

/** Max dots shown before a "+N more" badge */
export const MAX_VISIBLE_DOTS = 6;

/** Palette of vivid, distinct colors (Habbo-style) */
const DOT_COLORS = [
  '#FF5733', // red-orange
  '#33B5FF', // sky blue
  '#7CFF33', // lime green
  '#FF33E9', // hot pink
  '#FFBC33', // amber
  '#33FFF6', // cyan
  '#A633FF', // purple
  '#FF8C33', // orange
  '#33FF8C', // mint
  '#FF3380', // rose
  '#3380FF', // royal blue
  '#FFE933', // yellow
];

/**
 * Returns a deterministic color for a given agent ID.
 * Uses simple char-code hash → palette index.
 */
export function getAgentColor(agentId: string): string {
  if (!agentId) return DOT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) & 0x7fffffff;
  }
  return DOT_COLORS[hash % DOT_COLORS.length];
}

/**
 * Get initials from a display name (first letter, uppercase).
 */
export function getAgentInitial(displayName: string): string {
  if (!displayName) return '?';
  return displayName.charAt(0).toUpperCase();
}

/**
 * Returns the "pulse speed" class based on agent count.
 * More agents → faster pulse (room feels more active).
 */
export function getPulseClass(totalAgents: number): string {
  if (totalAgents >= 6) return 'pulse-fast';
  if (totalAgents >= 3) return 'pulse-medium';
  return 'pulse-slow';
}

/**
 * Render HTML for agent dot previews in a room card.
 * Shows up to MAX_VISIBLE_DOTS dots, then "+N more" badge.
 * Returns empty string if no agents.
 */
export function renderAgentDots(agents: AgentPreview[]): string {
  if (!agents || agents.length === 0) {
    return '<div class="agent-dot-container agent-dot-empty"><span class="agent-dot-empty-label">No agents</span></div>';
  }

  const visible = agents.slice(0, MAX_VISIBLE_DOTS);
  const overflow = agents.length - visible.length;
  const pulseClass = getPulseClass(agents.length);

  const dots = visible.map(agent => {
    const color = getAgentColor(agent.id);
    const initial = getAgentInitial(agent.displayName);
    const safeName = escapeHtml(agent.displayName);
    return `<span 
      class="agent-dot ${pulseClass}" 
      style="background-color: ${color};" 
      title="${safeName}" 
      data-agent-id="${escapeHtml(agent.id)}"
      aria-label="Agent: ${safeName}"
    >${initial}</span>`;
  }).join('');

  const overflowBadge = overflow > 0
    ? `<span class="agent-dot-overflow" title="${overflow} more agent${overflow > 1 ? 's' : ''}">+${overflow}</span>`
    : '';

  return `<div class="agent-dot-container" data-agent-count="${agents.length}">${dots}${overflowBadge}</div>`;
}

/**
 * Update dots in an existing room card element.
 * Finds the .agent-dot-container and replaces its content.
 * Returns true if updated, false if card not found.
 */
export function updateRoomCardDots(
  roomCardEl: HTMLElement,
  agents: AgentPreview[]
): boolean {
  const container = roomCardEl.querySelector('.agent-dot-container');
  if (!container) return false;

  const newHtml = renderAgentDots(agents);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = newHtml;
  const newContainer = wrapper.firstElementChild;
  if (newContainer) {
    container.replaceWith(newContainer);
  }
  return true;
}

/** Simple HTML escape for user-provided strings */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
