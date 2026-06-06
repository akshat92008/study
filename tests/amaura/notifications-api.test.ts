import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/amaura/notifications/route';
import * as serverSupabase from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

function mockClient(user: any, state: { notifications: any[] }) {
  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from: vi.fn((table) => {
      if (table === 'amaura_notifications') {
        const query: any = {
          select: vi.fn(() => query),
          update: vi.fn((updates) => {
            query._updates = updates;
            return query;
          }),
          eq: vi.fn((field, value) => {
            query._filters = query._filters || [];
            query._filters.push({ field, value });
            return query;
          }),
          or: vi.fn(() => query),
          order: vi.fn(() => query),
          limit: vi.fn((limitVal) => {
            query._limit = limitVal;
            return query;
          }),
          then: (resolve: any) => {
            if (query._updates) {
               state.notifications = state.notifications.map(n => {
                 const matchesUser = query._filters.find((f: any) => f.field === 'user_id')?.value === n.user_id;
                 const matchesId = query._filters.find((f: any) => f.field === 'id')?.value === n.id;
                 const matchesRead = query._filters.find((f: any) => f.field === 'read')?.value === n.read;
                 
                 const idMatch = query._filters.some((f:any) => f.field === 'id') ? matchesId : true;
                 const readMatch = query._filters.some((f:any) => f.field === 'read') ? matchesRead : true;

                 if (matchesUser && idMatch && readMatch) {
                    return { ...n, ...query._updates };
                 }
                 return n;
               });
               return resolve({ error: null });
            }

            if (query._filters && query._filters.some((f:any) => f.field === 'read' && f.value === false)) {
                // unread count mock
                const unreadCount = state.notifications.filter(n => n.read === false && n.user_id === user.id).length;
                return resolve({ count: unreadCount, error: null });
            }

            const data = state.notifications.filter(n => n.user_id === user.id);
            return resolve({ data, error: null });
          }
        };
        return query;
      }
      return {};
    }),
  };
  vi.mocked(serverSupabase.createClient).mockResolvedValue(supabase as any);
  return supabase;
}

describe('/api/amaura/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns notifications and unread count', async () => {
    const state = {
      notifications: [
        { id: '11111111-1111-1111-1111-111111111111', user_id: 'user-1', read: false, type: 'goal_decomposed' },
        { id: '22222222-2222-2222-2222-222222222222', user_id: 'user-1', read: true, type: 'plan_adapted' },
      ],
    };
    mockClient({ id: 'user-1' }, state);

    const response = await GET(new NextRequest('http://localhost/api/amaura/notifications'));
    expect(response.status).toBe(200);
    
    const json = await response.json();
    expect(json.notifications).toHaveLength(2);
    expect(json.unreadCount).toBe(1);
  });

  it('PATCH marks a notification as read', async () => {
    const state = {
      notifications: [
        { id: '11111111-1111-1111-1111-111111111111', user_id: 'user-1', read: false, type: 'goal_decomposed' },
      ],
    };
    mockClient({ id: 'user-1' }, state);

    const response = await PATCH(new NextRequest('http://localhost/api/amaura/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ id: '11111111-1111-1111-1111-111111111111' }),
    }));
    expect(response.status).toBe(200);
    expect(state.notifications[0].read).toBe(true);
  });
  
  it('PATCH all=true marks all as read', async () => {
    const state = {
      notifications: [
        { id: '11111111-1111-1111-1111-111111111111', user_id: 'user-1', read: false, type: 'goal_decomposed' },
        { id: '22222222-2222-2222-2222-222222222222', user_id: 'user-1', read: false, type: 'plan_adapted' },
      ],
    };
    mockClient({ id: 'user-1' }, state);

    const response = await PATCH(new NextRequest('http://localhost/api/amaura/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ all: true }),
    }));
    expect(response.status).toBe(200);
    expect(state.notifications.every(n => n.read === true)).toBe(true);
  });
});
