import type { NextConfig } from 'next';
import { validateEnvironment } from './lib/utils/env-validate';

function getWithSentryConfig(): (config: NextConfig, options: Record<string, unknown>) => NextConfig {
  try {
    if (typeof require === 'function') {
      return require('@sentry/nextjs').withSentryConfig;
    }
  } catch {
    // Sentry is optional for local MVP validation.
  }
  return (config) => config;
}

// Validate at build/start time — fails fast before any request
if (
  process.env.NODE_ENV !== 'test' && 
  process.env.SKIP_ENV_VALIDATION !== '1' && 
  process.env.SKIP_ENV_VALIDATION !== 'true'
) {
  validateEnvironment();
}

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'pdf-parse',
    '@opentelemetry/sdk-node',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
    '@opentelemetry/sdk-trace-base'
  ],
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },

  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://api.groq.com https://api.deepseek.com;",
          },
        ],
      },
    ];
  },
};

const withSentryConfig = getWithSentryConfig();

export default withSentryConfig(nextConfig, {
  // Sentry org/project — set these as env vars in Vercel/GitHub
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps in CI/production, not local dev
  silent: process.env.NODE_ENV !== 'production',
  widenClientFileUpload: true,

  // If SENTRY_DSN is not set, the plugin is a no-op
  // so this is safe to leave in without an active account
});
