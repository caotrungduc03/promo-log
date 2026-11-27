import { describe, expect, it } from 'vitest';
import type { DayLog } from '../../types';
import { planTwoWaySync } from '../sheetSync';

function makeLog(
  date: string,
  morning: number[],
  updatedAt: string,
): DayLog {
  return {
    date,
    sessions: { morning, afternoon: [], evening: [] },
    updatedAt,
  };
}

describe('planTwoWaySync', () => {
  it('pulls remote-only days, pushes local-only days, and skips identical logs', () => {
    const localLogs = {
      '2026-11-25': makeLog('2026-11-25', [25], '2026-11-25T10:00:00.000Z'),
      '2026-11-27': makeLog('2026-11-27', [50], '2026-11-27T10:00:00.000Z'),
    };
    const remoteLogs = {
      '2026-11-25': makeLog('2026-11-25', [25], '2026-11-25T11:00:00.000Z'),
      '2026-11-26': makeLog('2026-11-26', [30], '2026-11-26T10:00:00.000Z'),
    };

    const plan = planTwoWaySync(
      localLogs,
      remoteLogs,
      '2026-11-26T12:00:00.000Z',
    );

    expect(plan.conflicts).toHaveLength(0);
    expect(plan.pulledCount).toBe(1);
    expect(Object.keys(plan.toPushLogs)).toEqual(['2026-11-27']);
    expect(plan.mergedLogs['2026-11-26']).toEqual(remoteLogs['2026-11-26']);
    expect(plan.mergedLogs['2026-11-27']).toEqual(localLogs['2026-11-27']);
  });

  it('auto-resolves when only one side changed after lastSyncedAt', () => {
    const lastSyncedAt = '2026-11-27T08:00:00.000Z';
    const localLogs = {
      '2026-11-26': makeLog('2026-11-26', [25], '2026-11-26T10:00:00.000Z'),
      '2026-11-27': makeLog('2026-11-27', [50], '2026-11-27T09:00:00.000Z'),
    };
    const remoteLogs = {
      '2026-11-26': makeLog('2026-11-26', [25, 25], '2026-11-27T09:00:00.000Z'),
      '2026-11-27': makeLog('2026-11-27', [25], '2026-11-27T07:00:00.000Z'),
    };

    const plan = planTwoWaySync(localLogs, remoteLogs, lastSyncedAt);

    expect(plan.conflicts).toHaveLength(0);
    expect(plan.pulledCount).toBe(1);
    expect(plan.mergedLogs['2026-11-26']).toEqual(remoteLogs['2026-11-26']);
    expect(Object.keys(plan.toPushLogs)).toEqual(['2026-11-27']);
  });

  it('flags a conflict when both local and remote changed differently since lastSyncedAt (or never synced)', () => {
    const localLogs = {
      '2026-11-27': makeLog('2026-11-27', [25, 25], '2026-11-27T09:00:00.000Z'),
    };
    const remoteLogs = {
      '2026-11-27': makeLog('2026-11-27', [45], '2026-11-27T09:15:00.000Z'),
    };

    const planAfterSync = planTwoWaySync(
      localLogs,
      remoteLogs,
      '2026-11-27T08:00:00.000Z',
    );
    expect(planAfterSync.conflicts).toHaveLength(1);
    expect(planAfterSync.conflicts[0].date).toBe('2026-11-27');

    const planFirstSync = planTwoWaySync(localLogs, remoteLogs, undefined);
    expect(planFirstSync.conflicts).toHaveLength(1);
  });

  it('pushes local deletions to Sheet instead of re-pulling deleted days, and flags conflict if remote updated newer', () => {
    const remoteLogs = {
      '2026-11-26': makeLog('2026-11-26', [25], '2026-11-26T10:00:00.000Z'),
      '2026-11-27': makeLog('2026-11-27', [50], '2026-11-27T11:00:00.000Z'),
    };
    const deletedDates = {
      '2026-11-26': '2026-11-27T09:00:00.000Z',
      '2026-11-27': '2026-11-27T09:00:00.000Z',
    };

    const plan = planTwoWaySync(
      {},
      remoteLogs,
      '2026-11-26T12:00:00.000Z',
      deletedDates,
    );

    expect(plan.pulledCount).toBe(0);
    expect(plan.mergedLogs['2026-11-26']).toBeUndefined();
    expect(plan.toDeleteDates).toEqual(['2026-11-26']);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].date).toBe('2026-11-27');
    expect(plan.conflicts[0].local).toBeUndefined();
  });
});
