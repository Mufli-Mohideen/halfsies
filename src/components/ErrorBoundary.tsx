import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Halfsies crashed', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="crash">
        <h1 className="t-title">The knife slipped.</h1>
        <p className="t-body">Something went wrong. Your scores are saved on this device.</p>
        <button className="btn btn-primary" onClick={() => window.location.assign('/')}>
          Reload
        </button>
      </main>
    );
  }
}
