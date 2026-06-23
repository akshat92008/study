import { featureFlags as registryFeatureFlags, isEnabled } from '@/lib/feature-registry';

export { isEnabled };

export const featureFlags = {
  ...registryFeatureFlags,
  autopsyUploads: () => isEnabled('ENABLE_AUTOPSY_UPLOADS', true),
};
