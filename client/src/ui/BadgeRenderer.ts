/**
 * BadgeRenderer — T-361
 * Renders up to 3 earned achievement badge icons next to agent names in the
 * room spectate view. Includes accessible tooltip on hover/focus.
 *
 * Pure utility functions — no DOM or PixiJS dependency for easy unit testing.
 */

export interface BadgeInfo {
  id: number;
  name: string;
  /** Emoji or short text symbol representing the badge */
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
}

/** Maximum badges shown next to an agent name */
export const MAX_DISPLAY_BADGES = 3;

/** Per-rarity border/highlight colors */
const RARITY_COLORS: Record<string, string> = {
  legendary: '#FFD700',
  epic:      '#9B59B6',
  rare:      '#3498DB',
  uncommon:  '#2ECC71',
  common:    '#95A5A6',
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Return the highlight color for a badge rarity.
 * Falls back to common color for unknown rarities.
 */
export function getRarityColor(rarity: string): string {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS['common'];
}

/**
 * Capitalize first letter of a string (used for rarity display).
 */
export function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a badge label suitable for aria-label / screen readers.
 */
export function formatBadgeLabel(badge: BadgeInfo): string {
  return `${badge.name} (${badge.rarity})`;
}

/**
 * Render the tooltip HTML for a single badge.
 * The tooltip is included inline and shown via CSS :hover / :focus-within.
 */
export function renderTooltip(badge: BadgeInfo): string {
  const rarityColor = getRarityColor(badge.rarity);
  const rarity = capitalizeFirst(badge.rarity);
  return (
    `<span class="badge-tooltip" role="tooltip">` +
    `<span class="badge-tooltip-icon">${badge.icon}</span>` +
    `<span class="badge-tooltip-name">${escapeHtml(badge.name)}</span>` +
    `<span class="badge-tooltip-rarity" style="color:${rarityColor}">${rarity}</span>` +
    `<span class="badge-tooltip-desc">${escapeHtml(badge.description)}</span>` +
    `</span>`
  );
}

/**
 * Render a single badge icon `<span>` with embedded tooltip.
 */
export function renderSingleBadge(badge: BadgeInfo): string {
  const rarityColor = getRarityColor(badge.rarity);
  const label      = escapeHtml(formatBadgeLabel(badge));
  const tooltip    = renderTooltip(badge);
  return (
    `<span` +
    ` class="agent-badge agent-badge-${badge.rarity}"` +
    ` style="border-color:${rarityColor}"` +
    ` aria-label="${label}"` +
    ` data-badge-id="${badge.id}"` +
    ` tabindex="0"` +
    `>` +
    `<span class="agent-badge-icon">${badge.icon}</span>` +
    tooltip +
    `</span>`
  );
}

/**
 * Render up to `maxDisplay` badge icons in a wrapper `<span>`.
 * Returns an empty container span when the badge list is empty.
 *
 * @param badges     Array of badges to display (sorted by caller)
 * @param maxDisplay Cap on visible badges (default MAX_DISPLAY_BADGES = 3)
 */
export function renderBadgeIcons(
  badges: BadgeInfo[],
  maxDisplay: number = MAX_DISPLAY_BADGES,
): string {
  if (!badges || badges.length === 0) {
    return '<span class="agent-badges agent-badges-empty" aria-hidden="true"></span>';
  }

  // Enforce positive maxDisplay
  const cap = Math.max(0, maxDisplay);
  const visible = badges.slice(0, cap);

  const icons = visible.map(renderSingleBadge).join('');
  return (
    `<span class="agent-badges" data-badge-count="${visible.length}">` +
    icons +
    `</span>`
  );
}

// ── DOM helpers (only available in browser context) ───────────────────────────

/**
 * Attach rendered badge icons immediately after a name DOM element.
 * Replaces any existing badge container to keep the DOM in sync.
 *
 * @param nameEl     The agent name element (e.g. a <span class="agent-name">)
 * @param badges     Current badge list for this agent
 * @param maxDisplay Max badges to show (default 3)
 * @returns          true if badges were attached; false if nameEl was invalid
 */
export function attachBadgesToNameElement(
  nameEl: Element | null,
  badges: BadgeInfo[],
  maxDisplay: number = MAX_DISPLAY_BADGES,
): boolean {
  if (!nameEl || !nameEl.parentElement) return false;

  // Remove any existing badge container next to this name element
  const existing = nameEl.parentElement.querySelector(
    `.agent-badges[data-for="${nameEl.getAttribute('data-agent-id')}"]`,
  );
  if (existing) existing.remove();

  // Also remove a generic sibling badge container
  const siblingBadge = nameEl.nextElementSibling;
  if (siblingBadge?.classList.contains('agent-badges') ||
      siblingBadge?.classList.contains('agent-badges-empty')) {
    siblingBadge.remove();
  }

  const html = renderBadgeIcons(badges, maxDisplay);
  const tmp  = document.createElement('span');
  tmp.innerHTML = html;
  const badgeEl = tmp.firstElementChild as Element | null;
  if (!badgeEl) return false;

  if (badges.length > 0) {
    badgeEl.setAttribute('data-for', nameEl.getAttribute('data-agent-id') ?? '');
  }

  nameEl.insertAdjacentElement('afterend', badgeEl);
  return true;
}

// ── Internal ──────────────────────────────────────────────────────────────────

/** Minimal HTML escape for user-provided strings */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
