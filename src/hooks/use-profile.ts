import { getUserProfile, updateUserProfile, uploadAvatar } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useProfile() {
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: getUserProfile,
    staleTime: Infinity,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { username: string; signature: string }) =>
      updateUserProfile(data.username, data.signature),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("个人资料更新成功");
    },
    onError: (error) => {
      // TanStack Query 的 onError 接收的错误可能是字符串或 Error 对象
      const message = typeof error === "string" ? error : (error as Error).message;
      toast.error(message || "更新失败，请重试");
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (newProfile) => {
      queryClient.setQueryData(["profile"], newProfile);
      toast.success("头像上传成功");
    },
    onError: (error) => {
      // TanStack Query 的 onError 接收的错误可能是字符串或 Error 对象
      const message = typeof error === "string" ? error : (error as Error).message;
      toast.error(message || "上传失败，请重试");
    },
  });

  return {
    profile: profile.data,
    isLoading: profile.isLoading,
    updateProfile: updateMutation.mutate,
    uploadAvatar: uploadAvatarMutation.mutate,
    isUpdating: updateMutation.isPending,
    isUploading: uploadAvatarMutation.isPending,
  };
}
