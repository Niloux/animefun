import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  MonitorCog,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Wifi,
  WifiOff,
  Wrench,
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

type StatusTone = "success" | "warning" | "neutral" | "loading";
type IconComponent = FC<{ className?: string }>;

interface SettingsPanelProps {
  title: string;
  description: string;
  icon: IconComponent;
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

interface StatusCardProps {
  title: string;
  value: string;
  detail: string;
  icon: IconComponent;
  tone?: StatusTone;
}

const statusToneClasses: Record<StatusTone, string> = {
  success:
    "border-primary/25 bg-primary/10 text-primary [&_.status-icon]:bg-primary/15",
  warning:
    "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-300 [&_.status-icon]:bg-amber-500/15",
  neutral:
    "border-border/70 bg-card/75 text-foreground [&_.status-icon]:bg-muted",
  loading:
    "border-border/70 bg-muted/35 text-muted-foreground [&_.status-icon]:bg-muted",
};

const SettingsPanel: FC<SettingsPanelProps> = ({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}) => (
  <section
    className={cn(
      "overflow-hidden rounded-2xl border border-border/70 bg-card/75 shadow-xs",
      className,
    )}
  >
    <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-2 sm:pt-1">{action}</div>
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
      "flex min-h-16 flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
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
      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        {children}
      </div>
    )}
  </div>
);

const StatusCard: FC<StatusCardProps> = ({
  title,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}) => (
  <div
    className={cn(
      "min-w-0 rounded-2xl border px-4 py-3 transition-colors",
      statusToneClasses[tone],
    )}
  >
    <div className="flex items-start gap-3">
      <div className="status-icon flex size-8 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 space-y-1">
        <div className="text-xs font-medium text-muted-foreground">{title}</div>
        <div className="truncate text-sm font-semibold">{value}</div>
        <div className="truncate text-xs text-muted-foreground">{detail}</div>
      </div>
    </div>
  </div>
);

const ConnectionStatusPill: FC<{
  isConnected: boolean;
  isChecking: boolean;
}> = ({ isConnected, isChecking }) => {
  const Icon = isChecking ? Loader2 : isConnected ? Wifi : WifiOff;

  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium",
        isConnected
          ? "border-primary/25 bg-primary/10 text-primary"
          : "border-border/70 bg-muted/40 text-muted-foreground",
      )}
    >
      <Icon className={cn("size-3.5", isChecking && "animate-spin")} />
      {isChecking ? "检测中" : isConnected ? "已连接" : "未连接"}
    </span>
  );
};

const SettingsLoading: FC = () => (
  <div className="w-full space-y-5">
    <div className="flex items-end justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-52" />
      </div>
      <Skeleton className="h-8 w-24 rounded-full" />
    </div>
    <div className="grid gap-3 md:grid-cols-3">
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
    </div>
    <Skeleton className="h-[420px] rounded-2xl" />
  </div>
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

  const { isConnected, isTesting, isChecking, lastCheck, testConnection } =
    useDownloaderConnection();

  const isContentVisible = useFadeIn(!loading && !!config);
  const hasApiUrl = Boolean(config?.api_url?.trim());
  const hasCredentials = Boolean(config?.username && config?.password);
  const configStatus = hasApiUrl
    ? hasCredentials
      ? "配置完整"
      : "缺少凭据"
    : "未配置";

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
        description: "如果没有收到通知，请检查系统通知权限",
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
    return <SettingsLoading />;
  }

  return (
    <div
      className={cn(
        "w-full space-y-5 transition-opacity duration-300",
        isContentVisible ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">设置</h1>
          <p className="text-sm text-muted-foreground">
            管理下载器连接、通知、外观和应用信息
          </p>
        </div>
        <ConnectionStatusPill
          isConnected={isConnected}
          isChecking={isChecking}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatusCard
          title="下载服务"
          value={isChecking ? "检测中" : isConnected ? "可以下载" : "不可用"}
          detail={
            isConnected
              ? "qBittorrent Web UI 已连接"
              : "需要可用的 qBittorrent Web UI"
          }
          icon={isConnected ? Wifi : WifiOff}
          tone={isChecking ? "loading" : isConnected ? "success" : "warning"}
        />
        <StatusCard
          title="配置状态"
          value={configStatus}
          detail={config?.api_url || "尚未保存 API 地址"}
          icon={Settings2}
          tone={hasApiUrl && hasCredentials ? "success" : "neutral"}
        />
        <StatusCard
          title="应用版本"
          value={`v${version ?? "..."}`}
          detail={
            lastCheck
              ? `连接检测 ${formatRelativeTime(lastCheck)}`
              : "本次会话尚未手动检测"
          }
          icon={Info}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SettingsPanel
          title="下载服务"
          description="保存 qBittorrent Web UI 配置后，AnimeFun 才能添加种子、同步进度和打开下载目录"
          icon={Wrench}
          action={
            <ConnectionStatusPill
              isConnected={isConnected}
              isChecking={isChecking}
            />
          }
        >
          <div className="space-y-5 px-5 py-5 sm:px-6">
            {!isConnected && (
              <Alert variant="warning" className="border-amber-300/60">
                <AlertCircle className="size-4" />
                <AlertTitle>下载器未连接</AlertTitle>
                <AlertDescription>
                  请确认 qBittorrent 正在运行，并且 Web UI 已启用。
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
                className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]"
              >
                <div className="space-y-5">
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
                          默认地址通常是 http://localhost:8080
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
                                onClick={() =>
                                  setShowPassword((visible) => !visible)
                                }
                                aria-label={
                                  showPassword ? "隐藏密码" : "显示密码"
                                }
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

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
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
                          测试已保存配置
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
                          保存并测试
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <aside className="space-y-4 border-t border-border/60 pt-5 text-sm lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                  <div className="space-y-2">
                    <div className="font-medium">连接检测</div>
                    <p className="leading-relaxed text-muted-foreground">
                      保存配置会立即检测连接；单独测试按钮只检测已经保存的配置。
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium">最后检测</div>
                    <p className="text-muted-foreground">
                      {lastCheck
                        ? formatRelativeTime(lastCheck)
                        : "尚未手动检测"}
                    </p>
                  </div>
                  <a
                    href="https://github.com/qbittorrent/qBittorrent/wiki"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    <HelpCircle className="size-4" />
                    查看 Web UI 文档
                    <ExternalLink className="size-3" />
                  </a>
                </aside>
              </form>
            </Form>
          </div>
        </SettingsPanel>

        <div className="space-y-4">
          <SettingsPanel
            title="界面"
            description="选择浅色、深色或跟随系统"
            icon={MonitorCog}
          >
            <SettingsRow title="主题模式" description="立即应用到整个应用">
              <ThemeToggle />
            </SettingsRow>
          </SettingsPanel>

          <SettingsPanel
            title="通知"
            description="确认系统通知权限是否可用"
            icon={Bell}
          >
            <div className="divide-y divide-border/60">
              <SettingsRow title="测试通知" description="发送一条本地测试通知">
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
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="leading-relaxed text-muted-foreground">
                  番剧详情页开启更新提醒后，新资源发布时会发送系统通知。
                </p>
              </div>
            </div>
          </SettingsPanel>

          <SettingsPanel
            title="关于"
            description="版本、来源和许可"
            icon={Info}
          >
            <div className="divide-y divide-border/60">
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
                <div className="flex flex-wrap justify-end gap-2">
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

              <SettingsRow title="许可" description="MIT License">
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
