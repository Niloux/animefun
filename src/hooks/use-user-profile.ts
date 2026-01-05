import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUserProfile,
  getAvatarDataUrl,
  updateUserProfile,
  updateUserAvatar,
  resetUserAvatar,
} from "@/lib/api";
import { toast } from "sonner";
import type { UserProfile } from "@/types/gen/user_profile";

const QUERY_KEY = ["user-profile"] as const;
const AVATAR_QUERY_KEY = ["avatar-data-url"] as const;

const DEFAULT_PROFILE: UserProfile = {
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

  // 头像 data URL 查询
  const avatarDataUrl = useQuery({
    queryKey: [...AVATAR_QUERY_KEY, profile.data?.has_custom_avatar],
    queryFn: getAvatarDataUrl,
    enabled: profile.data?.has_custom_avatar ?? false,
    staleTime: Infinity,
  });

  const updateMutation = useMutation({
    mutationFn: ({ name, bio }: { name: string; bio: string }) =>
      updateUserProfile(name, bio),
    onSuccess: (updatedProfile) => {
      // 直接设置新数据，避免竞态条件
      queryClient.setQueryData(QUERY_KEY, updatedProfile);
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
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(QUERY_KEY, updatedProfile);
      // 清除旧头像缓存，确保下次启动时从后端重新获取
      queryClient.setQueryData(AVATAR_QUERY_KEY, undefined);
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
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(QUERY_KEY, updatedProfile);
      queryClient.setQueryData([...AVATAR_QUERY_KEY, true], null);
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
    avatarDataUrl: avatarDataUrl.data ?? "",
    isLoading: profile.isPending,
    updateProfile: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    updateAvatar: avatarMutation.mutate,
    isUploadingAvatar: avatarMutation.isPending,
    resetAvatar: resetAvatarMutation.mutate,
    isResettingAvatar: resetAvatarMutation.isPending,
  };
}
