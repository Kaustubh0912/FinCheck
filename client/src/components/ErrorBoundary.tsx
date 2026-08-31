import React, { Component, ReactNode } from "react";
import { Icon } from "../lib/icons";

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
        <div className="auth-page">
          <div className="auth-card animate-pop" style={{ textAlign: "center" }}>
            <div className="auth-brand">
              <div className="splash-logo" style={{ background: "var(--expense-soft)", color: "var(--expense)" }}>
                <Icon name="warning" />
              </div>
              <h1 className="serif">Something went wrong</h1>
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                An unexpected error occurred. Your saved records and local state remain safe.
              </p>
            </div>
            <div className="row gap" style={{ marginTop: "20px" }}>
              <button
                className="btn btn-primary grow"
                onClick={() => window.location.reload()}
              >
                <Icon name="rotate" /> Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
