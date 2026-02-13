export const AUTO_MUTE_DURATION_MS = 30_000;
export const REPORT_THRESHOLD = 3;

type MuteEntry = {
  expiresAt: number;
  reason: string;
  roomId?: string;
};

type BanEntry = {
  reason: string;
  roomId?: string;
  expiresAt?: number;
};

const mutes = new Map<string, MuteEntry>();
const bans = new Map<string, BanEntry>();
const reports = new Map<string, string[]>();

export function muteAgent(
  agentId: string,
  durationMs: number,
  reason: string,
  roomId?: string
): void {
  mutes.set(agentId, {
    expiresAt: Date.now() + durationMs,
    reason,
    roomId,
  });
}

export function unmuteAgent(agentId: string): void {
  mutes.delete(agentId);
}

export function isMuted(agentId: string): boolean {
  const mute = mutes.get(agentId);
  if (!mute) {
    return false;
  }

  if (mute.expiresAt <= Date.now()) {
    mutes.delete(agentId);
    return false;
  }

  return true;
}

export function banAgent(agentId: string, reason: string, roomId?: string, expiresAt?: number): void {
  bans.set(agentId, {
    reason,
    roomId,
    expiresAt,
  });
}

export function unbanAgent(agentId: string): void {
  bans.delete(agentId);
}

export function isBanned(agentId: string, roomId?: string): boolean {
  const ban = bans.get(agentId);
  if (!ban) {
    return false;
  }

  if (typeof ban.expiresAt === 'number' && ban.expiresAt <= Date.now()) {
    bans.delete(agentId);
    return false;
  }

  if (!ban.roomId) {
    return true;
  }

  return ban.roomId === roomId;
}

export function reportAgent(reporterId: string, targetId: string, reason: string): { autoMuted: boolean } {
  void reason;

  const existingReporters = reports.get(targetId) ?? [];
  if (!existingReporters.includes(reporterId)) {
    existingReporters.push(reporterId);
    reports.set(targetId, existingReporters);
  }

  if (existingReporters.length >= REPORT_THRESHOLD) {
    muteAgent(targetId, AUTO_MUTE_DURATION_MS, `Auto-muted after ${REPORT_THRESHOLD} reports`);
    return { autoMuted: true };
  }

  return { autoMuted: false };
}

export function resetModeration(): void {
  mutes.clear();
  bans.clear();
  reports.clear();
}
