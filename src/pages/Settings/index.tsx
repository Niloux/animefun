import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { formatRelativeTime } from "@/lib/utils";
import type { DownloaderConfig } from "@/types/gen/downloader_config";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Download,
  ExternalLink,
  HelpCircle,
  Info,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import type { FC } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type FormConfig = {
  api_url: string;
  username: string;
  password: string;
};

const SettingsPage: FC = () => {
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

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
          description: `当前版本 ${result.currentVersion}已是最新`,
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={`py-0 mx-auto transition-opacity duration-300 ${
        isContentVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="space-y-12">
        {/* 下载配置 Group */}
        <section>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">下载配置</h2>
              <p className="text-sm text-muted-foreground mt-1">
                配置 qBittorrent 连接以启用下载功能
              </p>
            </div>
            <Badge
              variant={isConnected ? "default" : "secondary"}
              className="flex items-center px-3 py-1.5 text-sm"
            >
              {isConnected ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  已连接
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5" />
                  未连接
                </>
              )}
            </Badge>
          </div>

          <div className="space-y-4">
            {!isConnected && (
              <Alert variant="warning">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  未检测到 qBittorrent 连接。请确保 qBittorrent 正在运行并已启用
                  Web UI。
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    asChild
                  >
                    <a
                      href="https://www.qbittorrent.org/download.php"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      下载 qBittorrent
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>连接设置</CardTitle>
                    <CardDescription className="mt-1.5">
                      输入 qBittorrent Web UI 的连接信息
                    </CardDescription>
                  </div>
                  {lastCheck && (
                    <span className="text-xs text-muted-foreground">
                      最后检测: {formatRelativeTime(lastCheck)}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
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
                              className="font-mono text-sm border-border"
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
                              <Input
                                type="password"
                                {...field}
                                className="border-border"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={testConnection}
                        disabled={isTesting}
                        className="cursor-pointer transition-colors"
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
                        className="w-full sm:w-auto sm:ml-auto cursor-pointer transition-colors"
                      >
                        {form.formState.isSubmitting ? (
                          <>
                            <Spinner />
                            保存中...
                          </>
                        ) : (
                          <>
                            <Download />
                            保存配置
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <HelpCircle className="h-4 w-4" />
              <a
                href="https://github.com/qbittorrent/qBittorrent/wiki"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline flex items-center gap-1"
              >
                查看 qBittorrent 官方文档
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>

        {/* 外观设置 Group */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight">外观设置</h2>
            <p className="text-sm text-muted-foreground mt-1">自定义应用主题</p>
          </div>
          <Card>
            <CardContent className="flex items-center justify-between py-5">
              <div className="space-y-1">
                <div className="font-medium">主题模式</div>
                <div className="text-sm text-muted-foreground">
                  切换应用外观颜色（浅色/深色/跟随系统）
                </div>
              </div>
              <ThemeToggle />
            </CardContent>
          </Card>
        </section>

        {/* 通知设置 Group */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight">通知设置</h2>
            <p className="text-sm text-muted-foreground mt-1">
              管理系统通知功能
            </p>
          </div>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 pr-4">
                  <div className="font-medium">测试通知</div>
                  <div className="text-sm text-muted-foreground">
                    发送一条测试通知以确认系统权限设置正常
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleTestNotification}
                  disabled={isTestingNotification}
                  className="cursor-pointer transition-colors"
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
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex gap-2 text-sm">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">关于通知功能</p>
                    <p className="text-muted-foreground leading-relaxed">
                      当您订阅的番剧有新资源发布时，应用会在后台检测并发送通知。
                      请确保在番剧详情页开启&ldquo;更新提醒&rdquo;。
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 关于应用 Group */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight">关于</h2>
            <p className="text-sm text-muted-foreground mt-1">应用信息与更新</p>
          </div>
          <Card>
            <CardContent className="divide-y">
              {/* Version & Update */}
              <div className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <div className="font-medium">AnimeFun 版本</div>
                  <div className="text-sm text-muted-foreground">
                    当前版本: v{version ?? "..."}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckUpdate}
                  disabled={isCheckingUpdate}
                  className="cursor-pointer transition-colors"
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
              </div>

              {/* Data Sources */}
              <div className="py-4 space-y-3">
                <div className="text-sm font-medium">数据来源</div>
                <div className="flex gap-4">
                  <a
                    href="https://bgm.tv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Bangumi 番组计划
                  </a>
                  <a
                    href="https://mikanani.me"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Mikan Project
                  </a>
                </div>
              </div>

              {/* License */}
              <div className="pt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">MIT License</div>
                <div className="text-sm text-muted-foreground">
                  Powered by Tauri & React
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
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
