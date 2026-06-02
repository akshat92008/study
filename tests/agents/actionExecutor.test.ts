import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeAgentActions } from '@/lib/agents/action-executor';
import type { CheapAgentAction } from '@/lib/agents/cheap-types';

function createClient(overrides: Record<string, any> = {}) {
  const calls: Array<{ table: string; op: string; payload?: any }> = [];
  const client = {
    calls,
    from(table: string) {
      const tableOverride = overrides[table] ?? {};
      const chain: any = {
        insert(payload: any) {
          calls.push({ table, op: 'insert', payload });
          if (tableOverride.insertError) return selectable(tableOverride.insertError);
          return selectable(null, { id: `${table}-id` });
        },
        upsert(payload: any) {
          calls.push({ table, op: 'upsert', payload });
          if (tableOverride.upsertError) return selectable(tableOverride.upsertError);
          return selectable(null, { id: `${table}-id`, ...payload });
        },
        select() { return chain; },
        eq() { return chain; },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        single() { return Promise.resolve({ data: { id: `${table}-id` }, error: null }); },
      };
      return chain;
    },
  };
  return client as any;
}

function selectable(error: any, data: any = { id: 'row-id' }) {
  return {
    select() {
      return {
        single() {
          return Promise.resolve({ data, error });
        },
      };
    },
  };
}

const baseAction: CheapAgentAction = {
  userId: '00000000-0000-0000-0000-000000000001',
  eventId: '00000000-0000-0000-0000-000000000002',
  agent: 'REVISION',
  actionType: 'create_revision_card_from_verified_mistake',
  riskLevel: 'safe',
  reason: 'test action',
  confidence: 0.8,
  payload: {
    sourceType: 'verified_mistake',
    sourceId: 'attempt-1',
    topic: 'Motion',
    front: 'Recall Motion',
    back: 'Solve one similar question.',
  },
};

describe('action executor', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('applies allowed beta actions and persists applied status when enabled', async () => {
    vi.stubEnv('ENABLE_AGENT_ACTIONS', 'true');
    const client = createClient();
    const result = await executeAgentActions([baseAction], { client });

    expect(result.applied).toBe(1);
    expect(client.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'revision_cards', op: 'insert' }),
      expect.objectContaining({ table: 'agent_actions', op: 'upsert' }),
    ]));
  });

  it('skips unknown actions even when enabled', async () => {
    vi.stubEnv('ENABLE_AGENT_ACTIONS', 'true');
    const client = createClient();
    const result = await executeAgentActions([{
      ...baseAction,
      agent: 'COMMAND',
      actionType: 'replace_daily_plan',
      riskLevel: 'medium',
    }], { client });

    expect(result.skipped).toBe(1);
    expect(result.actions[0].status).toBe('SKIPPED_INTENTIONALLY');
    expect(client.calls).toEqual([]);
  });

  it('persists failed action when application fails', async () => {
    vi.stubEnv('ENABLE_AGENT_ACTIONS', 'true');
    const client = createClient({ revision_cards: { insertError: new Error('db failed') } });
    const result = await executeAgentActions([baseAction], { client });

    expect(result.failed).toBe(1);
    expect(client.calls.find((call) => call.table === 'agent_actions')?.payload.status).toBe('failed');
  });

  it('skips mutations when agent actions are disabled', async () => {
    vi.stubEnv('ENABLE_AGENT_ACTIONS', 'false');
    const client = createClient();
    const result = await executeAgentActions([baseAction], { client });

    expect(result.skipped).toBe(1);
    expect(result.actions[0].status).toBe('SKIPPED_INTENTIONALLY');
    expect(client.calls).toEqual([]);
  });
});
