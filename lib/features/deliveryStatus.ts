export type DeliveryStatus = 'delivered' | 'beta' | 'hidden';

export type DeliveryModule =
  | 'core_loop'
  | 'amaura_runtime'
  | 'notifications'
  | 'activity_feed'
  | 'repair'
  | 'autopsy'
  | 'revision'
  | 'practice_sets'
  | 'notes'
  | 'url_ingestion'
  | 'billing'
  | 'export'
  | 'account_delete'
  | 'admin';

export const deliveryStatus: Record<DeliveryModule, DeliveryStatus> = {
  core_loop: 'delivered',
  amaura_runtime: 'delivered',
  notifications: 'delivered',
  activity_feed: 'delivered',
  repair: 'delivered',
  autopsy: 'delivered',
  revision: 'delivered',
  practice_sets: 'delivered',
  notes: 'delivered',
  url_ingestion: 'delivered',
  billing: 'hidden',
  export: 'delivered',
  account_delete: 'delivered',
  admin: 'beta',
};

export function isDeliveredModule(module: DeliveryModule) {
  return deliveryStatus[module] === 'delivered';
}

export function isVisibleModule(module: DeliveryModule) {
  return deliveryStatus[module] !== 'hidden';
}
