import { Component, ReactNode } from "react";

interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<{children: ReactNode}, State> {
  state = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error('Uncaught:', error); }

  render() {
    if (this.state.hasError) return <h2>程序出错了，刷新试试</h2>;
    return this.props.children;
  }
}
