import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { cn, resolveAvatarUrl } from "@/lib/utils";
import { Camera, Upload } from "lucide-react";
import { useMemo, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileEditDialog({ open, onOpenChange }: Props) {
  const { profile, updateProfile, uploadAvatar, isUpdating, isUploading } =
    useProfile();

  // Use a key based on profile version to reset form when profile changes externally
  const profileKey = profile
    ? `${profile.username}-${profile.signature}`
    : "initial";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={profileKey}
        className="sm:max-w-[425px] p-0 gap-0 overflow-hidden border-none shadow-xl"
      >
        <div className="sr-only">
          <DialogTitle>编辑个人资料</DialogTitle>
          <DialogDescription>编辑用户名和个性签名</DialogDescription>
        </div>

        <ProfileEditDialogContent
          profile={profile}
          updateProfile={updateProfile}
          uploadAvatar={uploadAvatar}
          isUpdating={isUpdating}
          isUploading={isUploading}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function ProfileEditDialogContent({
  profile,
  updateProfile,
  uploadAvatar,
  isUpdating,
  isUploading,
  onOpenChange,
}: {
  profile: ReturnType<typeof useProfile>["profile"];
  updateProfile: ReturnType<typeof useProfile>["updateProfile"];
  uploadAvatar: ReturnType<typeof useProfile>["uploadAvatar"];
  isUpdating: boolean;
  isUploading: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Initialize form state from profile
  const [username, setUsername] = useState(profile?.username || "");
  const [signature, setSignature] = useState(profile?.signature || "");
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);

  // Safely get avatar URL with fallback
  const avatarUrl = useMemo(
    () => resolveAvatarUrl(profile?.avatar_path),
    [profile],
  );

  const isUsernameInvalid = username.length === 0 || username.length > 50;
  const isSignatureInvalid = signature.length > 200;
  const isFormInvalid = isUsernameInvalid || isSignatureInvalid;

  const getLengthColor = (current: number, max: number) => {
    if (current > max) return "text-destructive";
    if (current >= max * 0.9) return "text-yellow-500 dark:text-yellow-400";
    return "text-muted-foreground/60";
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormInvalid) return;
    updateProfile(
      { username, signature },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  const handleUploadAvatar = () => {
    uploadAvatar();
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col relative">
      {/* Loading Overlay */}
      {isUpdating && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[1px] rounded-lg animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="text-xs font-medium text-muted-foreground">
              保存中...
            </span>
          </div>
        </div>
      )}

      {/* Decorative Banner */}
      <div className="h-32 bg-linear-to-br from-primary/20 via-primary/10 to-background w-full relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />
        <div className="absolute inset-0 bg-linear-to-t from-background/80 to-transparent" />
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/5 blur-3xl animate-pulse" />
        <div className="absolute left-10 top-10 h-20 w-20 rounded-full bg-primary/10 blur-2xl animate-bounce duration-3000" />
      </div>

      <div className="px-6 pb-6 -mt-12 flex flex-col gap-6">
        {/* Avatar Section */}
        <div className="flex justify-center">
          <div
            className="relative group cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={handleUploadAvatar}
            onMouseEnter={() => setIsAvatarHovered(true)}
            onMouseLeave={() => setIsAvatarHovered(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                handleUploadAvatar();
              }
            }}
          >
            <div className="relative w-24 h-24 rounded-full border-4 border-background shadow-lg overflow-hidden transition-transform duration-300 group-hover:scale-105 ring-1 ring-border/10">
              <img
                src={avatarUrl}
                alt="头像"
                className={cn(
                  "w-full h-full object-cover transition-all duration-300",
                  isAvatarHovered && "brightness-75 scale-110",
                )}
              />
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                  isAvatarHovered ? "opacity-100" : "opacity-0",
                )}
              >
                <Upload className="w-8 h-8 text-white drop-shadow-md" />
              </div>
            </div>

            {/* Badge */}
            <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground p-1.5 rounded-full shadow-md border-2 border-background transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12">
              {isUploading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="username"
                className="text-sm font-semibold text-foreground/80"
              >
                用户名
              </Label>
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  getLengthColor(username.length, 50),
                )}
              >
                {username.length}/50
              </span>
            </div>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="怎么称呼你？"
              disabled={isUpdating}
              className={cn(
                "h-11 transition-all focus-visible:ring-primary/20",
                isUsernameInvalid &&
                  "border-destructive focus-visible:ring-destructive/20",
              )}
            />
            {isUsernameInvalid && (
              <p className="text-[11px] text-destructive font-medium animate-in slide-in-from-top-1">
                {username.length === 0 ? "用户名不能为空" : "用户名太长了"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="signature"
                className="text-sm font-semibold text-foreground/80"
              >
                个性签名
              </Label>
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  getLengthColor(signature.length, 200),
                )}
              >
                {signature.length}/200
              </span>
            </div>
            <Textarea
              id="signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="写点什么..."
              disabled={isUpdating}
              className={cn(
                "resize-none min-h-[100px] transition-all focus-visible:ring-primary/20",
                isSignatureInvalid &&
                  "border-destructive focus-visible:ring-destructive/20",
              )}
            />
            {isSignatureInvalid && (
              <p className="text-[11px] text-destructive font-medium animate-in slide-in-from-top-1">
                签名太长了，精简一下吧
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer hover:bg-muted text-muted-foreground"
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={isUpdating || isUploading || isFormInvalid}
            className="cursor-pointer min-w-[80px]"
          >
            {isUpdating ? "保存中..." : "保存更改"}
          </Button>
        </DialogFooter>
      </div>
    </form>
  );
}
