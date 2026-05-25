'use client';

import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught:', error, info);
    // In production: send to your monitoring service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          padding: 'var(--sp-8)', textAlign: 'center',
          color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)'
        }}>
          <p>Something went wrong loading this section.</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: 'var(--sp-4)', padding: '8px 16px',
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-primary)'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
