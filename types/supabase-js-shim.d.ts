declare module '@supabase/supabase-js' {
  export type Json =
    | string
    | number
    | boolean
    | null
    | Json[]
    | { [key: string]: Json };

  export interface User {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    [key: string]: unknown;
  }

  export interface Session {
    user: User;
    access_token?: string;
    [key: string]: unknown;
  }

  export interface AuthError {
    message: string;
    status?: number;
  }

  export interface PostgrestError {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  }

  export interface DatabaseRow {
    id: string;
    user_id: string;
    session_id: string;
    concept_id: string;
    autopsy_id: string;
    title: string;
    description: string;
    content: string;
    role: string;
    type: string;
    status: string;
    subject: string;
    chapter: string;
    category: string;
    ai_analysis: string;
    mistake_category: string;
    priority: string;
    metadata: Record<string, unknown>;
    messages: Array<Record<string, unknown>>;
    scheduled_date: string;
    scheduled_start_time: string;
    created_at: string;
    updated_at: string;
    due_date: string;
    due: string;
    started_at: string;
    completed_at: string;
    last_reviewed_at: string;
    last_updated_at: string;
    is_completed: boolean;
    is_active: boolean;
    understood: boolean;
    cards_created: number;
    estimated_minutes: number;
    duration_minutes: number;
    marks_lost: number;
    current_score: number;
    potential_score: number;
    recoverable_marks: number;
    mentor_quote: string | null;
    mentor_insight: string | null;
    exam_type: string | null;
    exam: string;
    emotional_state: string;
    full_name: string;
    learning_style: string;
    strengths: string[];
    weaknesses: string[];
    behavioral_traps: string[];
    mastery: string;
    mastery_score: number;
    confidence_score: number;
    forgetting_probability: number;
    times_reviewed: number;
    review_count: number;
    reps: number;
    lapses: number;
    stability: number;
    difficulty: number;
    questions_attempted: number;
    questions_correct: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost: number;
    request_count: number;
    daily_budget_usd: number;
    used_budget_usd: number;
    from_concept_id: string;
    to_concept_id: string;
    source_concept_id: string;
    target_concept_id: string;
    link_type: string;
    weight: number;
    source: string | null;
    source_type: string | null;
    source_id: string | null;
    source_event_id: string | null;
    reason: string | null;
    question: string;
    answer: string;
    front: string;
    back: string;
    name: string;
    notes: string | null;
    focus_score: number;
    processed_at: string;
    locked_until: string;
    attempts: number;
    error: string | null;
    fatigue_threshold_minutes: number;
    peak_productivity_hour: number;
    target_date: string;
    progress: number;
    focus_topic: string;
    rationale: string;
    path: string;
    file_path: string;
    extracted_text: string;
    performance_snapshots: Array<Record<string, number | string>>;
    session_metadata: Record<string, unknown>;
    [key: string]: any;
  }

  export interface QueryResponse<TData> {
    data: TData;
    error: PostgrestError | null;
    count: number | null;
  }

  export interface QueryBuilder<TRow extends DatabaseRow = DatabaseRow> extends PromiseLike<QueryResponse<TRow[]>> {
    select(columns?: string, options?: { count?: string; head?: boolean }): QueryBuilder<TRow>;
    insert(values: Record<string, unknown> | Array<Record<string, unknown>>): QueryBuilder<TRow>;
    update(values: Record<string, unknown>): QueryBuilder<TRow>;
    upsert(values: Record<string, unknown> | Array<Record<string, unknown>>, options?: Record<string, unknown>): QueryBuilder<TRow>;
    delete(options?: Record<string, unknown>): QueryBuilder<TRow>;
    eq(column: string, value: unknown): QueryBuilder<TRow>;
    neq(column: string, value: unknown): QueryBuilder<TRow>;
    is(column: string, value: unknown): QueryBuilder<TRow>;
    not(column: string, operator: string, value: unknown): QueryBuilder<TRow>;
    gt(column: string, value: unknown): QueryBuilder<TRow>;
    gte(column: string, value: unknown): QueryBuilder<TRow>;
    lt(column: string, value: unknown): QueryBuilder<TRow>;
    lte(column: string, value: unknown): QueryBuilder<TRow>;
    ilike(column: string, pattern: string): QueryBuilder<TRow>;
    in(column: string, values: unknown[]): QueryBuilder<TRow>;
    contains(column: string, value: unknown): QueryBuilder<TRow>;
    textSearch(column: string, query: string, options?: Record<string, unknown>): QueryBuilder<TRow>;
    order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryBuilder<TRow>;
    limit(count: number): QueryBuilder<TRow>;
    range(from: number, to: number): QueryBuilder<TRow>;
    single(): Promise<QueryResponse<TRow>>;
    maybeSingle(): Promise<QueryResponse<TRow | null>>;
  }

  export interface RealtimePostgresChangesPayload<TRow extends DatabaseRow = DatabaseRow> {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    new: TRow;
    old: Partial<TRow>;
  }

  export interface RealtimeChannel {
    on(
      type: string,
      filter: Record<string, unknown>,
      callback: (payload: RealtimePostgresChangesPayload) => void
    ): RealtimeChannel;
    subscribe(callback?: (status: string) => void): RealtimeChannel;
  }

  export interface SupabaseAuthClient {
    getUser(): Promise<{ data: { user: User | null }; error: AuthError | null }>;
    signUp(credentials: Record<string, unknown>): Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | null }>;
    signInWithPassword(credentials: Record<string, unknown>): Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | null }>;
    signInAnonymously(): Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | null }>;
    signOut(): Promise<{ error: AuthError | null }>;
  }

  export interface StorageFileApi {
    upload(path: string, file: unknown, options?: Record<string, unknown>): Promise<{ data: DatabaseRow | null; error: PostgrestError | null }>;
    download(path: string): Promise<{ data: Blob | null; error: PostgrestError | null }>;
    createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: PostgrestError | null }>;
    remove(paths: string[]): Promise<{ data: DatabaseRow[] | null; error: PostgrestError | null }>;
    getPublicUrl(path: string): { data: { publicUrl: string } };
  }

  export interface SupabaseStorageClient {
    from(bucket: string): StorageFileApi;
  }

  export interface SupabaseClient {
    auth: SupabaseAuthClient;
    storage: SupabaseStorageClient;
    from<TRow extends DatabaseRow = DatabaseRow>(table: string): QueryBuilder<TRow>;
    rpc(fn: string, args?: Record<string, unknown>): any;
    channel(name: string, options?: Record<string, unknown>): RealtimeChannel;
    removeChannel(channel: RealtimeChannel): Promise<{ error: AuthError | null }>;
  }

  export function createClient(...args: unknown[]): SupabaseClient;
}
