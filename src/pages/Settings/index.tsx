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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
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
    values: config
      ? {
          api_url: config.api_url,
          username: config.username ?? "",
          password: config.password ?? "",
        }
      : undefined,
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
      className={`max-w-3xl mx-auto transition-opacity duration-300 ${
        isContentVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">设置</h1>
        <p className="text-muted-foreground mt-2">管理应用配置和偏好</p>
      </div>

      <Tabs defaultValue="download">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="download" className="cursor-pointer">
            下载
          </TabsTrigger>
          <TabsTrigger value="appearance" className="cursor-pointer">
            外观
          </TabsTrigger>
          <TabsTrigger value="notification" className="cursor-pointer">
            通知
          </TabsTrigger>
          <TabsTrigger value="about" className="cursor-pointer">
            关于
          </TabsTrigger>
        </TabsList>

        <TabsContent value="download" className="space-y-6 mt-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">下载配置</h2>
              <p className="text-muted-foreground mt-1">
                配置 qBittorrent 连接以启用下载功能
              </p>
            </div>
            <Badge
              variant={isConnected ? "default" : "secondary"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm"
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

          <Card className="shadow-sm">
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
                      className="w-full sm:w-auto bg-transparent cursor-pointer"
                    >
                      {isTesting ? (
                        <>
                          <Spinner className="mr-2 h-4 w-4" />
                          测试中...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          测试连接
                        </>
                      )}
                    </Button>
                    <Button
                      type="submit"
                      disabled={form.formState.isSubmitting}
                      className="w-full sm:w-auto sm:ml-auto cursor-pointer"
                    >
                      {form.formState.isSubmitting ? (
                        <>
                          <Spinner className="mr-2 h-4 w-4" />
                          保存中...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          保存配置
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <HelpCircle className="h-4 w-4" />
              <span className="font-medium">需要帮助？</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Button variant="ghost" size="sm" asChild>
                <a
                  href="https://github.com/qbittorrent/qBittorrent/wiki"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  qBittorrent 官方文档
                </a>
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6 mt-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">外观设置</h2>
            <p className="text-muted-foreground mt-1">自定义应用主题</p>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>主题</CardTitle>
              <CardDescription className="mt-1.5">
                选择应用的外观主题
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <ThemeToggle />
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Sun className="h-4 w-4" />
                    <span>浅色</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Monitor className="h-4 w-4" />
                    <span>跟随系统</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Moon className="h-4 w-4" />
                    <span>深色</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notification" className="space-y-6 mt-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">通知设置</h2>
            <p className="text-muted-foreground mt-1">管理系统通知功能</p>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>测试通知</CardTitle>
              <CardDescription className="mt-1.5">
                测试系统通知功能是否正常工作
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    当您订阅的番剧有新资源发布时，应用会发送系统通知。
                    点击下方按钮测试通知功能。
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleTestNotification}
                  disabled={isTestingNotification}
                  className="shrink-0 cursor-pointer"
                >
                  {isTestingNotification ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      发送中...
                    </>
                  ) : (
                    <>
                      <Bell className="mr-2 h-4 w-4" />
                      测试通知
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>关于通知</CardTitle>
              <CardDescription className="mt-1.5">通知功能说明</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">如何开启通知</p>
                <p>
                  在番剧详情页订阅番剧后，点击&ldquo;已开启通知&rdquo;按钮即可开启该番剧的更新提醒。
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">系统权限</p>
                <p>
                  首次使用通知功能时，系统会请求通知权限。请确保允许应用发送通知。
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">通知时机</p>
                <p>
                  当您订阅的番剧有新资源发布时（Mikan Project 更新 RSS），
                  应用会在后台检测并发送通知。
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="space-y-6 mt-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">关于</h2>
            <p className="text-muted-foreground mt-1">应用信息</p>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>AnimeFun</CardTitle>
              <CardDescription>跨平台桌面番剧订阅客户端</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">版本</p>
                  <p className="font-medium">{version ?? "..."}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">构建</p>
                  <p className="font-medium">Tauri 2 + React 19</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground">自动更新</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      应用启动时会自动检查更新
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckUpdate}
                    disabled={isCheckingUpdate}
                    className="cursor-pointer"
                  >
                    {isCheckingUpdate ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        检查中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        检查更新
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-muted-foreground">数据来源</p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="justify-start"
                  >
                    <a
                      href="https://bgm.tv"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Bangumi 番组计划
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="justify-start"
                  >
                    <a
                      href="https://mikanani.me"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Mikan Project
                    </a>
                  </Button>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2">开源协议</p>
                <p className="font-medium">MIT License</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <UpdateDialog
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
        updateInfo={updateInfo}
      />
    </div>
  );
};

export default SettingsPage;
