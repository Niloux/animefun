import { Component, ReactNode } from "react";
import { Loader2Icon } from "lucide-react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("Uncaught error:", error);
    // 可以在这里添加错误上报逻辑
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    // 强制刷新当前路由组件
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
          <h2 className="text-2xl font-bold text-destructive">程序出错了</h2>
          <p className="text-muted-foreground text-center">
            抱歉，程序发生了错误，请尝试刷新页面
          </p>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <Loader2Icon className="w-4 h-4" />
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
