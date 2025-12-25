import * as React from "react";
import { Button } from "./ui/button";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";
import type { Anime } from "@/types/gen/bangumi";

type SubscribeButtonProps = {
  anime: Anime;
  isSubscribed: boolean;
  toggle: (anime: Anime) => Promise<boolean>;
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
};

export function SubscribeButton({
  anime,
  isSubscribed,
  toggle,
  size = "lg",
  className,
}: SubscribeButtonProps) {
  const [loading, setLoading] = React.useState(false);

  const handleSubscribe = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const subscribed = await toggle(anime);
      if (subscribed) {
        toast.success("订阅成功");
      } else {
        toast.error("订阅失败，请重试");
      }
    } catch {
      toast.error("订阅失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const subscribed = await toggle(anime);
      if (!subscribed) {
        toast.success("已取消订阅");
      } else {
        toast.error("取消失败，请重试");
      }
    } catch {
      toast.error("取消订阅失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  if (isSubscribed) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="default"
            size={size}
            className={className}
            aria-pressed={true}
            title="已订阅"
            disabled={loading}
          >
            <Heart className="h-4 w-4" fill="currentColor" />
            已订阅
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消订阅？</AlertDialogTitle>
            <AlertDialogDescription>
              取消后将不再收到更新提醒，仍可在详情页重新订阅。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnsubscribe}>
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Button
      variant="outline"
      size={size}
      className={className}
      aria-pressed={false}
      onClick={handleSubscribe}
      title="未订阅"
      disabled={loading}
    >
      <Heart className="h-4 w-4" />
      未订阅
    </Button>
  );
}
