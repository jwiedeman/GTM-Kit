import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { GtmErrorBoundary } from '../error-boundary';

let shouldThrow = true;

const ThrowingComponent = ({ error }: { error: Error }) => {
  if (shouldThrow) {
    throw error;
  }
  return <div>Recovered</div>;
};

describe('GtmErrorBoundary', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    shouldThrow = true;
    // Suppress React error boundary console.error in tests
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children when no error occurs', () => {
    shouldThrow = false;
    render(
      <GtmErrorBoundary>
        <div>Child content</div>
      </GtmErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeTruthy();
  });

  it('renders fallback ReactNode when error occurs', () => {
    render(
      <GtmErrorBoundary fallback={<div>GTM failed</div>}>
        <ThrowingComponent error={new Error('GTM error')} />
      </GtmErrorBoundary>
    );

    expect(screen.getByText('GTM failed')).toBeTruthy();
  });

  it('renders fallback function with error and reset when error occurs', () => {
    const fallbackFn = jest.fn((error: Error, _reset: () => void) => (
      <div>Error: {error.message}</div>
    ));

    render(
      <GtmErrorBoundary fallback={fallbackFn}>
        <ThrowingComponent error={new Error('test error')} />
      </GtmErrorBoundary>
    );

    expect(screen.getByText('Error: test error')).toBeTruthy();
    expect(fallbackFn).toHaveBeenCalledWith(expect.any(Error), expect.any(Function));
  });

  it('resets error state when reset function is called', () => {
    let resetFn: () => void;
    const fallbackFn = jest.fn((_error: Error, reset: () => void) => {
      resetFn = reset;
      return <div>Error occurred</div>;
    });

    const { rerender } = render(
      <GtmErrorBoundary fallback={fallbackFn}>
        <ThrowingComponent error={new Error('reset test')} />
      </GtmErrorBoundary>
    );

    expect(screen.getByText('Error occurred')).toBeTruthy();

    // Stop throwing and reset the boundary
    shouldThrow = false;
    act(() => {
      resetFn!();
    });

    rerender(
      <GtmErrorBoundary fallback={fallbackFn}>
        <ThrowingComponent error={new Error('reset test')} />
      </GtmErrorBoundary>
    );

    expect(screen.getByText('Recovered')).toBeTruthy();
  });

  it('calls onError callback when error is caught', () => {
    const onError = jest.fn();

    render(
      <GtmErrorBoundary onError={onError} fallback={<div>Error</div>}>
        <ThrowingComponent error={new Error('callback test')} />
      </GtmErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'callback test' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('does not throw if onError callback throws', () => {
    const onError = jest.fn(() => {
      throw new Error('callback error');
    });

    expect(() => {
      render(
        <GtmErrorBoundary onError={onError} fallback={<div>Error</div>}>
          <ThrowingComponent error={new Error('original error')} />
        </GtmErrorBoundary>
      );
    }).not.toThrow();
  });

  it('logs errors in development mode by default', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <GtmErrorBoundary fallback={<div>Error</div>}>
        <ThrowingComponent error={new Error('log test')} />
      </GtmErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      '[gtm-kit/next] Error caught by GtmErrorBoundary:',
      expect.any(Error)
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('suppresses logs when logErrors is false', () => {
    const consoleErrorCalls = (console.error as jest.Mock).mock.calls.length;

    render(
      <GtmErrorBoundary logErrors={false} fallback={<div>Error</div>}>
        <ThrowingComponent error={new Error('silent test')} />
      </GtmErrorBoundary>
    );

    // console.error should not have been called by our component
    const newCalls = (console.error as jest.Mock).mock.calls.slice(consoleErrorCalls);
    const ourCalls = newCalls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('gtm-kit/next')
    );
    expect(ourCalls.length).toBe(0);
  });
});
