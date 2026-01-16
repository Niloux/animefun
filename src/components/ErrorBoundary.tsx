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
        <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-6 animate-in fade-in-50 duration-500">
          <div className="rounded-full bg-destructive/10 p-4">
            <Loader2Icon className="w-8 h-8 text-destructive animate-spin" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">程序出错了</h2>
            <p className="text-muted-foreground text-sm">
              抱歉，遇到了一些意外情况。
            </p>
          </div>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
