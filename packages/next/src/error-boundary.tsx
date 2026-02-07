'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Props for GtmErrorBoundary component.
 */
export interface GtmErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI to render when an error occurs */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Callback invoked when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to log errors to console (default: true in development) */
  logErrors?: boolean;
}

interface GtmErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for GTM provider in Next.js apps.
 * Catches errors during GTM initialization and renders a fallback UI.
 * Analytics and tracking will be disabled when an error occurs.
 *
 * @example
 * ```tsx
 * import { GtmErrorBoundary } from '@jwiedeman/gtm-kit-next';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <GtmErrorBoundary fallback={<div>GTM failed to load</div>}>
 *           {children}
 *         </GtmErrorBoundary>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export class GtmErrorBoundary extends Component<GtmErrorBoundaryProps, GtmErrorBoundaryState> {
  constructor(props: GtmErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): GtmErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, logErrors = process.env.NODE_ENV !== 'production' } = this.props;

    if (logErrors) {
      console.error('[gtm-kit/next] Error caught by GtmErrorBoundary:', error);
      console.error('[gtm-kit/next] Component stack:', errorInfo.componentStack);
    }

    if (onError) {
      try {
        onError(error, errorInfo);
      } catch {
        // Ignore callback errors
      }
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback === undefined) {
        // Default: render children without GTM (silent fallback)
        return children;
      }

      if (typeof fallback === 'function') {
        return fallback(error, this.reset);
      }

      return fallback;
    }

    return children;
  }
}
