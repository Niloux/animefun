import { useEffect } from "react";
import { toast } from "sonner";

type UseToastOnErrorOptions = {
  error: unknown;
  onRetry?: () => void;
  duration?: number;
  title?: string;
};

export function useToastOnError(options: UseToastOnErrorOptions) {
  const { error, onRetry, duration = 5000, title = "请求失败" } = options;

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      const toastOptions = {
        duration,
        ...(onRetry && {
          action: {
            label: "重试",
            onClick: onRetry,
          },
        }),
      };

      toast.error(`${title}: ${message}`, toastOptions);
    }
  }, [error, onRetry, duration, title]);
}

export default useToastOnError;
