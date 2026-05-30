declare module 'zustand' {
  export type SetState<TState> = (
    partial: Partial<TState> | ((state: TState) => Partial<TState>),
    replace?: boolean
  ) => void;

  export type GetState<TState> = () => TState;

  export interface StoreApi<TState> {
    setState: SetState<TState>;
    getState: GetState<TState>;
  }

  export type StateCreator<TState, _Mutators = [], _StoreMutators = [], TSlice = TState> = (
    set: SetState<TState>,
    get: GetState<TState>,
    api: StoreApi<TState>
  ) => TSlice;

  export interface UseBoundStore<TState> {
    (): TState;
    <TSelected>(selector: (state: TState) => TSelected): TSelected;
    getState: GetState<TState>;
    setState: SetState<TState>;
  }

  export function create<TState>(): (initializer: StateCreator<TState>) => UseBoundStore<TState>;
  export function create<TState>(initializer: StateCreator<TState>): UseBoundStore<TState>;
}

declare module 'zustand/middleware' {
  import type { StateCreator } from 'zustand';

  export interface PersistOptions<TState> {
    name: string;
    partialize?: (state: TState) => Partial<TState> | Record<string, unknown>;
    [key: string]: unknown;
  }

  export function persist<TState>(
    initializer: StateCreator<TState>,
    options?: PersistOptions<TState>
  ): StateCreator<TState>;
}
