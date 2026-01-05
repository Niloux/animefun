import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUserProfile,
  updateUserProfile,
  updateUserAvatar,
  resetUserAvatar,
} from "@/lib/api";
import { toast } from "sonner";

const QUERY_KEY = ["user-profile"];

const DEFAULT_PROFILE = {
  name: "喜多郁代",
  bio: "きた,いくよ",
  has_custom_avatar: false,
};

export function useUserProfile() {
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getUserProfile,
    staleTime: Infinity,
  });

  const updateMutation = useMutation({
    mutationFn: ({ name, bio }: { name: string; bio: string }) =>
      updateUserProfile(name, bio),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("资料已更新");
    },
    onError: (error) => {
      toast.error("更新失败", {
        description: String(error),
      });
    },
  });

  const avatarMutation = useMutation({
    mutationFn: updateUserAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("头像已更新");
    },
    onError: (error) => {
      toast.error("头像上传失败", {
        description: String(error),
      });
    },
  });

  const resetAvatarMutation = useMutation({
    mutationFn: resetUserAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("头像已重置");
    },
    onError: (error) => {
      toast.error("重置失败", {
        description: String(error),
      });
    },
  });

  return {
    profile: profile.data ?? DEFAULT_PROFILE,
    isLoading: profile.isPending,
    updateProfile: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    updateAvatar: avatarMutation.mutate,
    isUploadingAvatar: avatarMutation.isPending,
    resetAvatar: resetAvatarMutation.mutate,
    isResettingAvatar: resetAvatarMutation.isPending,
  };
}
