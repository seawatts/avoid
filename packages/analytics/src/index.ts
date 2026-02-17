import type { DbClient } from "@seawatts/db";
import {
  getSessionCount,
  getCompletedSessionCount,
  getTimerCompletionRate,
  getAvoidanceTypeStats,
} from "@seawatts/db";
import type { AvoidanceType } from "@seawatts/db";

export interface AnalyticsSummary {
  totalSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  timerCompletionRate: number;
  avoidanceTypeBreakdown: Record<string, number>;
  mostCommonType: AvoidanceType | null;
}

export function getAnalyticsSummary(db: DbClient): AnalyticsSummary {
  const totalSessions = getSessionCount(db);
  const completedSessions = getCompletedSessionCount(db);
  const timerCompletionRate = getTimerCompletionRate(db);
  const avoidanceTypeBreakdown = getAvoidanceTypeStats(db);

  let mostCommonType: AvoidanceType | null = null;
  let maxCount = 0;
  for (const [type, count] of Object.entries(avoidanceTypeBreakdown)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonType = type as AvoidanceType;
    }
  }

  return {
    totalSessions,
    completedSessions,
    abandonedSessions: totalSessions - completedSessions,
    timerCompletionRate,
    avoidanceTypeBreakdown,
    mostCommonType,
  };
}

export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  // Local-only analytics tracking stub.
  // Can be extended to send events to PostHog or other services.
  if (process.env.DEBUG) {
    console.log(`[analytics] ${name}`, properties ?? "");
  }
}
