import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'cheating' | 'impersonation' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export type AgentReport = {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: ReportReason;
  description: string;
  roomId: string | null;
  status: ReportStatus;
  resolvedBy: string | null;
  resolutionNote: string;
  createdAt: Date;
  resolvedAt: Date | null;
};

/**
 * Create a new report
 */
export async function createReport(
  reporterId: string,
  reportedId: string,
  reason: ReportReason,
  description: string,
  roomId: string | null,
  sql: Sql
): Promise<AgentReport> {
  // Can't self-report
  if (reporterId === reportedId) {
    throw new Error('Cannot report yourself');
  }

  // Check pending reports count for reporter
  const [countResult] = await sql<{ count: number }[]>`
    SELECT COUNT(*) as count
    FROM agent_reports
    WHERE reporter_id = ${reporterId} AND status = 'pending'
  `;

  if (countResult.count >= 5) {
    throw new Error('Too many pending reports. Please wait for existing reports to be reviewed.');
  }

  // Validate description length
  if (description.length > 500) {
    throw new Error('Description must be 500 characters or less');
  }

  const id = randomUUID();
  const [report] = await sql<AgentReport[]>`
    INSERT INTO agent_reports (id, reporter_id, reported_id, reason, description, room_id, status)
    VALUES (${id}, ${reporterId}, ${reportedId}, ${reason}, ${description}, ${roomId}, 'pending')
    RETURNING 
      id, 
      reporter_id AS "reporterId", 
      reported_id AS "reportedId", 
      reason, 
      description, 
      room_id AS "roomId", 
      status, 
      resolved_by AS "resolvedBy", 
      resolution_note AS "resolutionNote", 
      created_at AS "createdAt", 
      resolved_at AS "resolvedAt"
  `;

  return report;
}

/**
 * Get reports by status with pagination
 */
export async function getReportsByStatus(
  status: ReportStatus | null,
  limit: number,
  offset: number,
  sql: Sql
): Promise<AgentReport[]> {
  if (status) {
    return await sql<AgentReport[]>`
      SELECT 
        id, 
        reporter_id AS "reporterId", 
        reported_id AS "reportedId", 
        reason, 
        description, 
        room_id AS "roomId", 
        status, 
        resolved_by AS "resolvedBy", 
        resolution_note AS "resolutionNote", 
        created_at AS "createdAt", 
        resolved_at AS "resolvedAt"
      FROM agent_reports
      WHERE status = ${status}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return await sql<AgentReport[]>`
    SELECT 
      id, 
      reporter_id AS "reporterId", 
      reported_id AS "reportedId", 
      reason, 
      description, 
      room_id AS "roomId", 
      status, 
      resolved_by AS "resolvedBy", 
      resolution_note AS "resolutionNote", 
      created_at AS "createdAt", 
      resolved_at AS "resolvedAt"
    FROM agent_reports
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

/**
 * Get all reports against a specific agent
 */
export async function getReportsAgainst(agentId: string, sql: Sql): Promise<AgentReport[]> {
  return await sql<AgentReport[]>`
    SELECT 
      id, 
      reporter_id AS "reporterId", 
      reported_id AS "reportedId", 
      reason, 
      description, 
      room_id AS "roomId", 
      status, 
      resolved_by AS "resolvedBy", 
      resolution_note AS "resolutionNote", 
      created_at AS "createdAt", 
      resolved_at AS "resolvedAt"
    FROM agent_reports
    WHERE reported_id = ${agentId}
    ORDER BY created_at DESC
  `;
}

/**
 * Resolve a report (admin/mod only)
 */
export async function resolveReport(
  reportId: string,
  resolvedBy: string,
  status: 'reviewed' | 'resolved' | 'dismissed',
  note: string,
  sql: Sql
): Promise<void> {
  const [report] = await sql<AgentReport[]>`
    SELECT id, status FROM agent_reports WHERE id = ${reportId}
  `;

  if (!report) {
    throw new Error('Report not found');
  }

  if (report.status !== 'pending') {
    throw new Error('Report has already been processed');
  }

  await sql`
    UPDATE agent_reports
    SET status = ${status}, resolved_by = ${resolvedBy}, resolution_note = ${note}, resolved_at = NOW()
    WHERE id = ${reportId}
  `;
}

/**
 * Get total count of reports against an agent
 */
export async function getReportCount(agentId: string, sql: Sql): Promise<number> {
  const [result] = await sql<{ count: number }[]>`
    SELECT COUNT(*) as count
    FROM agent_reports
    WHERE reported_id = ${agentId}
  `;

  return result.count;
}

/**
 * Get count of pending reports
 */
export async function getPendingCount(sql: Sql): Promise<number> {
  const [result] = await sql<{ count: number }[]>`
    SELECT COUNT(*) as count
    FROM agent_reports
    WHERE status = 'pending'
  `;

  return result.count;
}
