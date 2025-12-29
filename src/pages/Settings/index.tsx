import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { useFadeIn } from "@/hooks/use-fade-in";
import { useDownloaderConnection } from "@/hooks/use-connection-state";
import { useSimpleQuery } from "@/hooks/use-simple-query";
import { getDownloaderConfig, setDownloaderConfig } from "@/lib/api";
import type { DownloaderConfig } from "@/types/gen/downloader_config";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  HelpCircle,
  Loader2,
  XCircle,
} from "lucide-react";
import type { FC } from "react";
import { useForm } from "react-hook-form";

type FormConfig = {
  api_url: string;
  username: string;
  password: string;
};

const SettingsPage: FC = () => {
  const { data: config, loading } = useSimpleQuery<DownloaderConfig>({
    queryKey: ["downloader-config"],
    queryFn: getDownloaderConfig,
    errorTitle: "加载配置失败",
  });

  const { isConnected, isTesting, lastCheck, testConnection } =
    useDownloaderConnection();

  // 内容淡入动画：配置加载完成后触发
  const isContentVisible = useFadeIn(!loading && !!config);

  const form = useForm<FormConfig>({
    defaultValues: {
      api_url: config?.api_url ?? "http://localhost:8080",
      username: config?.username ?? "admin",
      password: config?.password ?? "adminadmin",
    },
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const formatLastCheck = () => {
    if (!lastCheck) return "从未检测";
    const now = new Date();
    const diffMs = now.getTime() - lastCheck.getTime();
    if (diffMs < 60000) return "刚刚";
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} 分钟前`;
    return lastCheck.toLocaleTimeString();
  };

  return (
    <div
      className={`container max-w-3xl mx-auto py-8 px-4 transition-opacity duration-300 ${
        isContentVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">下载配置</h1>
            <p className="text-muted-foreground mt-2">
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
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <AlertDescription className="text-amber-900 dark:text-amber-200">
              未检测到 qBittorrent 连接。请确保 qBittorrent 正在运行并已启用 Web
              UI。
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 ml-1 text-amber-900 dark:text-amber-200"
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
      </div>

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
                最后检测: {formatLastCheck()}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                        className="font-mono text-sm"
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
                        <Input {...field} placeholder="admin" />
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
                        <Input type="password" {...field} />
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
                  className="w-full sm:w-auto bg-transparent"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                  className="w-full sm:w-auto sm:ml-auto"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

      <div className="mt-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <HelpCircle className="h-4 w-4" />
          <span className="font-medium">需要帮助？</span>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="banned" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
                <span>IP 被封禁怎么办？</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-2">
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  多次登录失败会导致 IP 被临时封禁。请按以下步骤解除封禁：
                </p>
                <ol className="list-decimal ml-5 space-y-2 text-muted-foreground">
                  <li>打开 qBittorrent 应用程序</li>
                  <li>
                    进入{" "}
                    <strong className="text-foreground">
                      工具 → 选项 → Web UI
                    </strong>
                  </li>
                  <li>
                    点击{" "}
                    <strong className="text-foreground">清除被禁用的 IP</strong>{" "}
                    按钮
                  </li>
                  <li>保存设置并重试</li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  提示：如果无法访问设置，可以尝试重启 qBittorrent 程序
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="api-url" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span>如何查找 API 地址？</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-2">
              <div className="space-y-3 text-sm">
                <ol className="list-decimal ml-5 space-y-2 text-muted-foreground">
                  <li>打开 qBittorrent 应用程序</li>
                  <li>
                    进入{" "}
                    <strong className="text-foreground">
                      工具 → 选项 → Web UI
                    </strong>
                  </li>
                  <li>查看端口号（默认为 8080）</li>
                  <li>
                    本机使用：
                    <code className="mx-1 bg-muted px-2 py-0.5 rounded text-xs font-mono">
                      http://localhost:端口号
                    </code>
                  </li>
                  <li>
                    局域网使用：
                    <code className="mx-1 bg-muted px-2 py-0.5 rounded text-xs font-mono">
                      http://设备IP:端口号
                    </code>
                  </li>
                </ol>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="examples" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span>配置示例</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-2">
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="font-medium text-sm mb-2">本地默认配置</p>
                  <div className="space-y-1 text-xs font-mono text-muted-foreground">
                    <div>API 地址: http://localhost:8080</div>
                    <div>用户名: admin</div>
                    <div>密码: （安装时设置的密码）</div>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="font-medium text-sm mb-2">局域网配置</p>
                  <div className="space-y-1 text-xs font-mono text-muted-foreground">
                    <div>API 地址: http://192.168.1.100:8080</div>
                    <div>用户名: admin</div>
                    <div>密码: （Web UI 登录密码）</div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <Button variant="ghost" size="sm" asChild>
            <a
              href="https://www.qbittorrent.org/download.php"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground"
            >
              <Download className="mr-2 h-4 w-4" />
              下载 qBittorrent
            </a>
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button variant="ghost" size="sm" asChild>
            <a
              href="https://github.com/qbittorrent/qBittorrent/wiki"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              官方文档
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
