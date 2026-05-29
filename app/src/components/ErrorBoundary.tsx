import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "./StateViews";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Heading for the fallback card. */
  title?: string;
  /** Label for the recovery button. Omit to hide the button. */
  resetLabel?: string;
  /** Called when the recovery button is clicked (after clearing the caught error). */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Diagnostics only — no telemetry. Surfaces in the WebView console.
    console.error("ErrorBoundary caught an error:", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (error) {
      const { title = "Something went wrong", resetLabel } = this.props;
      const message = error.message || String(error);
      return (
        <div className="p-4" role="alert" data-testid="error-boundary-fallback">
          <ErrorState title={title} message={message} />
          {resetLabel ? (
            <button
              type="button"
              className="btn-secondary mt-3 px-3 py-1.5 text-sm"
              data-testid="error-boundary-reset"
              onClick={this.handleReset}
            >
              {resetLabel}
            </button>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}
