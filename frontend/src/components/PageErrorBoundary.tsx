import { Component, type ReactNode } from "react";
import { EmptyState } from "./ui";

interface Props {
  children: ReactNode;
  standalone?: boolean;
  resetKey?: string;
}
interface State {
  failed: boolean;
  resetKey?: string;
}

// Suspense handles pending pages; this also catches rejected imports and render errors.
export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromProps(props: Props, state: State) {
    return props.resetKey === state.resetKey
      ? null
      : { failed: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const fallback = (
      <section className="panel" role="alert">
        <EmptyState
          title="Không thể mở trang này"
          icon="book"
          action={
            <button
              type="button"
              className="button button-primary"
              onClick={() => window.location.reload()}
            >
              Tải lại trang
            </button>
          }
        >
          Trang chưa tải được hoặc gặp sự cố. Hãy tải lại để tiếp tục.
        </EmptyState>
      </section>
    );
    return this.props.standalone ? (
      <main className="standalone">{fallback}</main>
    ) : (
      fallback
    );
  }
}
