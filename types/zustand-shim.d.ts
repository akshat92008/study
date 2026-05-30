declare module 'zustand' {
  export type StateCreator<TState, _Mutators = [], _StoreMutators = [], TSlice = TState> = (
    set: any,
    get: any,
    api: any
  ) => TSlice;

  export function create<TState>(): (initializer: any) => any;
  export function create<TState>(initializer: any): any;
}

declare module 'zustand/middleware' {
  export function persist<TState>(initializer: any, options?: any): any;
}
