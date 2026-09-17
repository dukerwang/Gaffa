import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { hasAccountPushSubscription } from '../subscribe';

const fakeSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => fakeSupabase,
}));

describe('hasAccountPushSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.window = {} as unknown as Window & typeof globalThis;
  });

  afterEach(() => {
    // @ts-expect-error cleanup
    delete globalThis.window;
  });

  it('returns false if window is undefined', async () => {
    // @ts-expect-error simulating ssr
    delete globalThis.window;
    const res = await hasAccountPushSubscription();
    expect(res).toBe(false);
  });

  it('returns false if user is not logged in', async () => {
    fakeSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await hasAccountPushSubscription();
    expect(res).toBe(false);
  });

  it('returns true if user has active push subscriptions', async () => {
    fakeSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
    fakeSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce({ count: 1, error: null }),
    });

    const res = await hasAccountPushSubscription();
    expect(res).toBe(true);
    expect(fakeSupabase.from).toHaveBeenCalledWith('push_subscriptions');
  });

  it('returns false if user has 0 push subscriptions', async () => {
    fakeSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
    fakeSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce({ count: 0, error: null }),
    });

    const res = await hasAccountPushSubscription();
    expect(res).toBe(false);
  });

  it('returns false on query error', async () => {
    fakeSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
    fakeSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce({ count: null, error: { message: 'DB error' } }),
    });

    const res = await hasAccountPushSubscription();
    expect(res).toBe(false);
  });
});
