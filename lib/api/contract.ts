export type RouteContract = {
  path: string;
  auth: 'public' | 'user' | 'admin' | 'internal';
  rateLimit: boolean;
  betaGate: boolean;
  featureFlag?: string;
  ownershipCheck?: boolean;
};

// You can use this helper to strongly type your contracts in route files:
// export const ROUTE_CONTRACT: RouteContract = { ... };
