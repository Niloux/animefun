import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import ThemeToggle from "@/components/ui/theme-toggle";
import { UpdateDialog } from "@/components/UpdateDialog";
import { useDownloaderConnection } from "@/hooks/use-connection-state";
import { useFadeIn } from "@/hooks/use-fade-in";
import { useSimpleQuery } from "@/hooks/use-simple-query";
import {
  checkUpdate,
  getAppVersion,
  getDownloaderConfig,
  sendTestNotification,
  setDownloaderConfig,
  type UpdateInfo,
} from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { DownloaderConfig } from "@/types/gen/downloader_config";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type FormConfig = {
  api_url: string;
  username: string;
  password: string;
};

interface SettingsPanelProps {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface SettingsRowProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

const SettingsPanel: FC<SettingsPanelProps> = ({
  title,
  description,
  action,
  children,
  className,
}) => (
  <section
    className={cn(
      "overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm",
      className,
    )}
  >
    <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
    {children}
  </section>
);

const SettingsRow: FC<SettingsRowProps> = ({
  title,
  description,
  children,
  className,
}) => (
  <div
    className={cn(
      "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
      className,
    )}
  >
    <div className="min-w-0 space-y-1 pr-0 sm:pr-6">
      <div className="text-sm font-medium">{title}</div>
      {description && (
        <div className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </div>
      )}
    </div>
    {children && (
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    )}
  </div>
);

const ConnectionStatusPill: FC<{ isConnected: boolean }> = ({
  isConnected,
}) => (
  <span
    className={cn(
      "inline-flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-medium",
      isConnected
        ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
        : "border-border/70 bg-muted/40 text-muted-foreground",
    )}
  >
    <span
      className={cn(
        "size-2 rounded-full",
        isConnected ? "bg-green-500" : "bg-muted-foreground/60",
      )}
    />
    {isConnected ? "已连接" : "未连接"}
  </span>
);

const SettingsPage: FC = () => {
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data: version } = useSimpleQuery<string>({
    queryKey: ["app-version"],
    queryFn: getAppVersion,
  });

  const { data: config, loading } = useSimpleQuery<DownloaderConfig>({
    queryKey: ["downloader-config"],
    queryFn: getDownloaderConfig,
    errorTitle: "加载配置失败",
  });

  const { isConnected, isTesting, lastCheck, testConnection } =
    useDownloaderConnection();

  const isContentVisible = useFadeIn(!loading && !!config);

  const form = useForm<FormConfig>({
    values: {
      api_url: config?.api_url ?? "",
      username: config?.username ?? "",
      password: config?.password ?? "",
    },
  });

  const onSubmit = async (data: FormConfig) => {
    const configToSave: DownloaderConfig = {
      api_url: data.api_url,
      username: data.username || null,
      password: data.password || null,
    };
    await setDownloaderConfig(configToSave);
    await testConnection();
  };

  const handleTestNotification = async () => {
    setIsTestingNotification(true);
    try {
      await sendTestNotification();
      toast.success("测试通知已发送", {
        description: "如果您没有收到通知，请检查系统通知设置",
      });
    } catch {
      toast.error("测试通知发送失败", {
        description: "请检查系统权限设置",
      });
    } finally {
      setIsTestingNotification(false);
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const result = await checkUpdate();
      if (!result) {
        toast.error("检查更新失败", {
          description: "请检查网络连接",
        });
        return;
      }
      if (result.available) {
        setUpdateInfo(result);
        setShowUpdateDialog(true);
      } else {
        toast.success("已是最新版本", {
          description: `当前版本 ${result.currentVersion} 已是最新`,
        });
      }
    } catch {
      toast.error("检查更新失败", {
        description: "请检查网络连接",
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={`w-full space-y-6 py-0 transition-opacity duration-300 ${
        isContentVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">设置</h1>
            <p className="text-sm text-muted-foreground">
              下载服务、通知和应用偏好
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConnectionStatusPill isConnected={isConnected} />
          <span className="inline-flex h-7 items-center rounded-full border border-border/70 bg-muted/40 px-3 text-xs font-medium text-muted-foreground tabular-nums">
            v{version ?? "..."}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <SettingsPanel
          title="下载服务"
          description="连接 qBittorrent Web UI 后，可以同步资源和管理下载任务"
          action={<ConnectionStatusPill isConnected={isConnected} />}
        >
          <div className="space-y-5 px-5 py-5 sm:px-6">
            {!isConnected && (
              <Alert variant="warning" className="border-border/60">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  未检测到 qBittorrent 连接。请确认 qBittorrent 正在运行并已启用
                  Web UI。
                  <Button
                    variant="link"
                    size="sm"
                    className="ml-1 h-auto p-0"
                    asChild
                  >
                    <a
                      href="https://www.qbittorrent.org/download.php"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      下载 qBittorrent
                      <ExternalLink className="ml-1 size-3" />
                    </a>
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <FormField
                  control={form.control}
                  name="api_url"
                  rules={{
                    required: "API 地址不能为空",
                    pattern: {
                      value: /^https?:\/\/.+/,
                      message: "请输入有效的 URL",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API 地址</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="http://localhost:8080"
                          className="border-border font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription>
                        默认为 http://localhost:8080
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="username"
                    rules={{ required: "用户名不能为空" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>用户名</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="admin"
                            className="border-border"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    rules={{ required: "密码不能为空" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>密码</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              {...field}
                              className="border-border pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent hover:text-foreground"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="size-4" />
                              ) : (
                                <Eye className="size-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={testConnection}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <>
                        <Spinner />
                        测试中...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 />
                        测试连接
                      </>
                    )}
                  </Button>
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting}
                    className="w-full sm:ml-auto sm:w-auto"
                  >
                    {form.formState.isSubmitting ? (
                      <>
                        <Spinner />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save />
                        保存配置
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>

            <div className="flex flex-col gap-2 border-t border-border/60 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>
                {lastCheck
                  ? `最后检测 ${formatRelativeTime(lastCheck)}`
                  : "尚未检测连接状态"}
              </div>
              <a
                href="https://github.com/qbittorrent/qBittorrent/wiki"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground hover:underline"
              >
                <HelpCircle className="size-4" />
                qBittorrent 文档
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </SettingsPanel>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <SettingsPanel title="界面" description="调整应用显示方式">
            <SettingsRow title="主题模式" description="浅色、深色或跟随系统">
              <ThemeToggle />
            </SettingsRow>
          </SettingsPanel>

          <SettingsPanel title="通知" description="确认系统通知是否可用">
            <div className="divide-y">
              <SettingsRow
                title="测试通知"
                description="发送一条测试通知确认系统权限"
              >
                <Button
                  variant="outline"
                  onClick={handleTestNotification}
                  disabled={isTestingNotification}
                >
                  {isTestingNotification ? (
                    <>
                      <Spinner />
                      发送中...
                    </>
                  ) : (
                    <>
                      <Bell />
                      发送测试
                    </>
                  )}
                </Button>
              </SettingsRow>

              <div className="flex gap-3 px-5 py-4 text-sm">
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="leading-relaxed text-muted-foreground">
                  订阅番剧有新资源发布时会发送通知。详情页开启“更新提醒”后生效。
                </p>
              </div>
            </div>
          </SettingsPanel>

          <SettingsPanel title="关于" description="版本、来源与许可">
            <div className="divide-y">
              <SettingsRow
                title="当前版本"
                description={`AnimeFun v${version ?? "..."}`}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckUpdate}
                  disabled={isCheckingUpdate}
                >
                  {isCheckingUpdate ? (
                    <>
                      <Spinner />
                      检查中...
                    </>
                  ) : (
                    <>
                      <RefreshCw />
                      检查更新
                    </>
                  )}
                </Button>
              </SettingsRow>

              <SettingsRow title="数据来源">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 hover:bg-muted"
                    asChild
                  >
                    <a
                      href="https://bgm.tv"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3.5" />
                      Bangumi
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 hover:bg-muted"
                    asChild
                  >
                    <a
                      href="https://mikanani.me"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3.5" />
                      Mikan
                    </a>
                  </Button>
                </div>
              </SettingsRow>

              <SettingsRow
                title="许可"
                description="MIT License"
                className="sm:items-start"
              >
                <span className="text-sm text-muted-foreground">
                  Tauri & React
                </span>
              </SettingsRow>
            </div>
          </SettingsPanel>
        </div>
      </div>

      <UpdateDialog
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
        updateInfo={updateInfo}
      />
    </div>
  );
};

export default SettingsPage;
