import React, { Component, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px 20px", textAlign: "center", fontFamily: "var(--font)", color: "var(--ink)" }}>
          <h2 style={{ fontFamily: "var(--serif)", marginBottom: "16px", color: "var(--expense)" }}>Something went wrong.</h2>
          <p className="muted">An unexpected error occurred in the application.</p>
          <button 
            className="btn btn-primary" 
            style={{ marginTop: "24px" }}
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
