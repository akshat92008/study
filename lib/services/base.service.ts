import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

export abstract class BaseService {
  /**
   * Retrieves an authenticated Supabase server client.
   * Useful for running queries with RLS enforced as the active user.
   */
  protected async getClient(): Promise<SupabaseClient> {
    return await createClient();
  }

  /**
   * Mock implementation of a transaction runner.
   * Since Supabase REST API does not support native multi-statement transactions natively
   * without RPC functions, this can be wrapped around RPC calls or multiple awaited
   * queries with manual rollback logic if needed.
   */
  protected async transaction<T>(callback: (client: SupabaseClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    // For now, this just passes the client. To implement real atomic transactions 
    // over REST, we would need to map this to a Postgres function (RPC).
    return callback(client);
  }
}
