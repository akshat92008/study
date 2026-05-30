declare module 'framer-motion' {
  import type * as React from 'react';

  type MotionComponents = {
    [K in keyof React.JSX.IntrinsicElements]: React.FC<any>;
  };

  export const motion: MotionComponents & Record<string, React.FC<any>>;
  export const AnimatePresence: React.FC<any>;
}
