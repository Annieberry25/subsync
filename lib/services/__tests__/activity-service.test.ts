import { describe, it, expect, beforeEach } from 'vitest';
import {
  getActivityHistory,
  recordActivity,
  getActivityPreviewTexts,
  type ActivityRecord,
} from '@/lib/services/activity-service';

beforeEach(() => {
  window.localStorage.clear();
});

describe('getActivityHistory', () => {
  it('returns an empty array when no activity is stored', () => {
    expect(getActivityHistory()).toEqual([]);
  });

  it('returns parsed records from storage', () => {
    const rec: ActivityRecord = {
      id: 'act-1',
      subscriptionName: 'Netflix',
      type: 'added',
      title: 'Added Netflix',
      description: 'New subscription added',
      timestamp: new Date().toISOString(),
    };
    window.localStorage.setItem('subsync_activity_log', JSON.stringify([rec]));
    expect(getActivityHistory()).toEqual([rec]);
  });
});

describe('recordActivity', () => {
  it('creates a record with id and timestamp, prepending to history', () => {
    const first = recordActivity({ subscriptionName: 'A', type: 'added', title: 't', description: 'd' });
    const second = recordActivity({ subscriptionName: 'B', type: 'reminder_sent', title: 't', description: 'd' });

    expect(first.id).toBeTruthy();
    expect(first.timestamp).toBeTruthy();

    const history = getActivityHistory();
    expect(history.length).toBe(2);
    expect(history[0].subscriptionName).toBe('B');
    expect(history[1].subscriptionName).toBe('A');
  });
});

describe('getActivityPreviewTexts', () => {
  it('returns full description for short text', () => {
    const out = getActivityPreviewTexts({ description: 'Short', timestamp: '', id: '', subscriptionName: '', type: 'added', title: '' } as ActivityRecord);
    expect(out.full).toBe('Short');
    expect(out.normal).toBe('Short...');
  });

  it('truncates long descriptions', () => {
    const long = 'x'.repeat(100);
    const out = getActivityPreviewTexts({ description: long, timestamp: '', id: '', subscriptionName: '', type: 'added', title: '' } as ActivityRecord);
    expect(out.normal.length).toBeLessThan(46);
    expect(out.normal.endsWith('...')).toBe(true);
    expect(out.full).toBe(long);
    expect(out.hover.length).toBeLessThan(86);
  });
});
