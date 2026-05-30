declare module '@supabase/supabase-js' {
  export type SupabaseClient = any;
  export type User = any;
  export type Session = any;
  export type AuthError = any;
  export type PostgrestError = any;

  export function createClient(...args: any[]): any;
}
