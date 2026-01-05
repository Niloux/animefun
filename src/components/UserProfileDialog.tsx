import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserProfile } from "@/hooks/use-user-profile";
import { Camera, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

export function UserProfileDialog({
  open,
  onOpenChange,
}: UserProfileDialogProps) {
  const {
    profile,
    avatarDataUrl,
    updateProfile,
    updateAvatar,
    resetAvatar,
    isUpdating,
    isUploadingAvatar,
  } = useUserProfile();

  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 当对话框打开时，同步 profile 的值到表单状态
  useEffect(() => {
    if (open) {
      setName(profile.name);
      setBio(profile.bio);
    }
  }, [open, profile.name, profile.bio]);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setPreviewUrl(null);
    }
    onOpenChange(newOpen);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("图片大小不能超过 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        setPreviewUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedBio = bio.trim();

    if (!trimmedName) {
      toast.error("名称不能为空");
      return;
    }

    // 先更新头像（如果有），再更新资料
    // 使用回调链确保两个操作都成功后才关闭对话框
    if (previewUrl) {
      updateAvatar(previewUrl, {
        onSuccess: () => {
          updateProfile({ name: trimmedName, bio: trimmedBio }, {
            onSuccess: () => onOpenChange(false),
          });
        },
      });
    } else {
      updateProfile({ name: trimmedName, bio: trimmedBio }, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const handleResetAvatar = () => {
    resetAvatar();
    setPreviewUrl(null);
  };

  const getDisplayAvatar = () => {
    if (previewUrl) return previewUrl;
    if (profile.has_custom_avatar && avatarDataUrl) {
      return avatarDataUrl;
    }
    return new URL("../assets/ikuyo-avatar.png", import.meta.url).href;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑个人资料</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <img
                src={getDisplayAvatar()}
                alt="avatar"
                className="w-24 h-24 rounded-2xl object-cover"
              />
              <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:text-white"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                </Button>
                {profile.has_custom_avatar && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white hover:text-white"
                    onClick={handleResetAvatar}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <p className="text-xs text-muted-foreground">
              支持 PNG、JPG、WEBP，最大 2MB
            </p>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入您的名称"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground text-right">
                {name.length}/20
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">签名</Label>
              <Input
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="输入您的签名"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground text-right">
                {bio.length}/50
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={isUpdating || isUploadingAvatar}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
