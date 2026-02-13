import { randomUUID } from 'node:crypto';

interface MuteRecord {
  agentId: string;
  roomId: string | null;
  reason: string;
  expiresAt: number;
}

interface BanRecord {
  id: string;
  agentId: string;
  bannedBy: string | null;
  reason: string;
  roomId: string | null;
  expiresAt: number | null;
  createdAt: string;
}

export interface ContentFilterResult {
  allowed: boolean;
  blockedTerm?: string;
}

export class ModerationService {
  private readonly blocklist: string[];
  private readonly mutes = new Map<string, MuteRecord>();
  private readonly bans = new Map<string, BanRecord[]>();

  constructor(blocklist: string[] = ['malware', 'phishing', 'hate']) {
    this.blocklist = blocklist.map((term) => term.toLowerCase());
  }

  filterContent(content: string): ContentFilterResult {
    const text = content.toLowerCase();
    const blocked = this.blocklist.find((term) => text.includes(term));
    if (!blocked) {
      return { allowed: true };
    }

    return {
      allowed: false,
      blockedTerm: blocked,
    };
  }

  muteAgent(agentId: string, roomId: string | null, durationSecs: number, reason: string): MuteRecord {
    const key = this.muteKey(agentId, roomId);
    const record: MuteRecord = {
      agentId,
      roomId,
      reason,
      expiresAt: Date.now() + durationSecs * 1000,
    };

    this.mutes.set(key, record);
    return record;
  }

  isMuted(agentId: string, roomId: string | null): boolean {
    const globalKey = this.muteKey(agentId, null);
    const roomKey = this.muteKey(agentId, roomId);

    const globalMute = this.mutes.get(globalKey);
    const roomMute = this.mutes.get(roomKey);

    return this.recordActive(globalMute, globalKey, this.mutes) || this.recordActive(roomMute, roomKey, this.mutes);
  }

  banAgent(
    agentId: string,
    roomId: string | null,
    reason: string,
    expiresAt: Date | null,
    bannedBy: string | null = null,
  ): BanRecord {
    const record: BanRecord = {
      id: randomUUID(),
      agentId,
      bannedBy,
      reason,
      roomId,
      expiresAt: expiresAt ? expiresAt.getTime() : null,
      createdAt: new Date().toISOString(),
    };

    const list = this.bans.get(agentId) ?? [];
    list.push(record);
    this.bans.set(agentId, list);

    return record;
  }

  isBanned(agentId: string, roomId: string | null): boolean {
    const now = Date.now();
    const records = this.bans.get(agentId) ?? [];

    const active = records.filter((record) => record.expiresAt === null || record.expiresAt > now);
    if (active.length !== records.length) {
      this.bans.set(agentId, active);
    }

    return active.some((record) => record.roomId === null || record.roomId === roomId);
  }

  private muteKey(agentId: string, roomId: string | null): string {
    return `${agentId}:${roomId ?? '*'}`;
  }

  private recordActive<T extends { expiresAt: number }>(record: T | undefined, key: string, store: Map<string, T>): boolean {
    if (!record) {
      return false;
    }

    if (record.expiresAt < Date.now()) {
      store.delete(key);
      return false;
    }

    return true;
  }
}
