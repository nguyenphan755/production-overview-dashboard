import React, { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallbackTitle?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-6 text-white/90 max-w-2xl mx-auto my-4">
          <h2 className="text-lg font-semibold text-red-300 mb-2">
            {this.props.fallbackTitle || 'Something went wrong in this section'}
          </h2>
          <p className="text-sm text-white/70 mb-4">{this.state.message}</p>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-sm"
            onClick={() => this.setState({ hasError: false, message: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
