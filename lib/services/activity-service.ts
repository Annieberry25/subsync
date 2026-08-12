export type ActivityType =
  | 'added'
  | 'edited'
  | 'renewed'
  | 'archived'
  | 'deleted'
  | 'restored'
  | 'reminder_sent'
  | 'updated';

export interface ActivityRecord {
  id: string;
  subscriptionId?: string;
  subscriptionName: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string; // ISO String
  amount?: number;
  currency?: string;
  metadata?: Record<string, any>;
}

const STORAGE_KEY = 'subsync_activity_log';

const CONCISE_DESCRIPTIONS: Record<string, string> = {
  'act-1': 'Automatic monthly renewal of subscription processed successfully. Your Netflix subscription was automatically renewed for $15.99.',
  'act-2': 'Upcoming subscription renewal reminder sent for Adobe Creative Cloud trial period ending in 2 days.',
  'act-3': 'Subscription information was updated for Spotify Premium price updated from $9.99 to $11.99/mo.',
  'act-4': 'Subscription details were edited for ChatGPT Plus primary payment method changed to Visa 4242.',
  'act-5': 'New subscription added to your account GitHub Copilot yearly plan added for $100.00/yr.',
  'act-6': 'Subscription moved to archive Hulu moved to archived subscriptions with inactive status.',
  'act-7': 'Subscription restored from archive Figma Professional restored to active tracking.',
  'act-8': 'Subscription removed from your account Duolingo Super soft-deleted from active subscriptions.',
};

const INITIAL_ACTIVITIES: ActivityRecord[] = [
  {
    id: 'act-1',
    subscriptionId: 'sub-netflix',
    subscriptionName: 'Netflix',
    type: 'renewed',
    title: 'Subscription Renewed',
    description: CONCISE_DESCRIPTIONS['act-1'],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    amount: 15.99,
    currency: 'USD',
  },
  {
    id: 'act-2',
    subscriptionId: 'sub-adobe',
    subscriptionName: 'Adobe Creative Cloud',
    type: 'reminder_sent',
    title: 'Renewal Reminder Sent',
    description: CONCISE_DESCRIPTIONS['act-2'],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: 'act-3',
    subscriptionId: 'sub-spotify',
    subscriptionName: 'Spotify Premium',
    type: 'updated',
    title: 'Subscription Info Updated',
    description: CONCISE_DESCRIPTIONS['act-3'],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    amount: 11.99,
    currency: 'USD',
  },
  {
    id: 'act-4',
    subscriptionId: 'sub-chatgpt',
    subscriptionName: 'ChatGPT Plus',
    type: 'edited',
    title: 'Subscription Details Edited',
    description: CONCISE_DESCRIPTIONS['act-4'],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
  },
  {
    id: 'act-5',
    subscriptionId: 'sub-github',
    subscriptionName: 'GitHub Copilot',
    type: 'added',
    title: 'Subscription Added',
    description: CONCISE_DESCRIPTIONS['act-5'],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    amount: 100.0,
    currency: 'USD',
  },
  {
    id: 'act-6',
    subscriptionId: 'sub-hulu',
    subscriptionName: 'Hulu',
    type: 'archived',
    title: 'Subscription Archived',
    description: CONCISE_DESCRIPTIONS['act-6'],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: 'act-7',
    subscriptionId: 'sub-figma',
    subscriptionName: 'Figma Professional',
    type: 'restored',
    title: 'Subscription Restored',
    description: CONCISE_DESCRIPTIONS['act-7'],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
  {
    id: 'act-8',
    subscriptionId: 'sub-duolingo',
    subscriptionName: 'Duolingo Super',
    type: 'deleted',
    title: 'Subscription Deleted',
    description: CONCISE_DESCRIPTIONS['act-8'],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
  },
];

export function getActivityHistory(): ActivityRecord[] {
  if (typeof window === 'undefined') return INITIAL_ACTIVITIES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ACTIVITIES));
      return INITIAL_ACTIVITIES;
    }
    const parsed: ActivityRecord[] = JSON.parse(stored);
    let updatedNeeded = false;
    const updatedActivities = parsed.map((act) => {
      if (CONCISE_DESCRIPTIONS[act.id] && act.description !== CONCISE_DESCRIPTIONS[act.id]) {
        updatedNeeded = true;
        return { ...act, description: CONCISE_DESCRIPTIONS[act.id] };
      }
      return act;
    });

    if (updatedNeeded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedActivities));
    }
    return updatedActivities;
  } catch {
    return INITIAL_ACTIVITIES;
  }
}

export function recordActivity(record: Omit<ActivityRecord, 'id' | 'timestamp'>): ActivityRecord {
  const newRecord: ActivityRecord = {
    ...record,
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      const current = getActivityHistory();
      const updated = [newRecord, ...current];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  }

  return newRecord;
}

export interface ActivityPreviewTexts {
  normal: string;
  hover: string;
  full: string;
}

export function getActivityPreviewTexts(act: ActivityRecord): ActivityPreviewTexts {
  const full = act.description;

  const PRESETS: Record<string, { normal: string; hover: string }> = {
    'act-1': {
      normal: 'Automatic monthly renewal of subscription...',
      hover: 'Automatic monthly renewal of subscription processed successfully. Your...',
    },
    'act-2': {
      normal: 'Upcoming subscription renewal reminder sent...',
      hover: 'Upcoming subscription renewal reminder sent for subscription — trial ending in 2 days...',
    },
    'act-3': {
      normal: 'Subscription information was updated...',
      hover: 'Subscription information was updated per provider changes — price set to $11.99/mo...',
    },
    'act-4': {
      normal: 'Subscription details were edited...',
      hover: 'Subscription details were edited — primary payment method updated to Visa 4242...',
    },
    'act-5': {
      normal: 'New subscription added to your account...',
      hover: 'New subscription added to your account — set up on yearly billing cycle...',
    },
    'act-6': {
      normal: 'Subscription moved to archive...',
      hover: 'Subscription moved to archive — status set to inactive tracking...',
    },
    'act-7': {
      normal: 'Subscription restored from archive...',
      hover: 'Subscription restored from archive — active tracking re-enabled...',
    },
    'act-8': {
      normal: 'Subscription removed from your account...',
      hover: 'Subscription removed from your account — soft-deleted by account user...',
    },
  };

  if (PRESETS[act.id]) {
    return {
      ...PRESETS[act.id],
      full,
    };
  }

  let normal = full.trim();
  if (normal.length > 45) {
    normal = normal.slice(0, 42).trim() + '...';
  } else if (!normal.endsWith('...')) {
    normal = normal + '...';
  }

  let hover = full.trim();
  if (hover.length > 85) {
    hover = hover.slice(0, 82).trim() + '...';
  } else if (!hover.endsWith('...')) {
    hover = hover + '...';
  }

  return { normal, hover, full };
}
