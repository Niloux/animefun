import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useDownloaderConnection } from "@/hooks/use-downloader-connection";
import { useSimpleQuery } from "@/hooks/use-simple-query";
import { getDownloaderConfig, setDownloaderConfig } from "@/lib/api";
import type { DownloaderConfig } from "@/types/gen/downloader_config";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Info,
  Loader2,
  XCircle,
} from "lucide-react";
import { FC } from "react";
import { useForm, useWatch } from "react-hook-form";

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

  const api_url = useWatch({
    control: form.control,
    name: "api_url",
  });

  const onSubmit = async (data: FormConfig) => {
    const configToSave: DownloaderConfig = {
      api_url: data.api_url,
      username: data.username || null,
      password: data.password || null,
    };
    await setDownloaderConfig(configToSave);
  };

  if (loading) {
    return <div className="p-4">加载中...</div>;
  }

  const formatLastCheck = () => {
    if (!lastCheck) return "未检测";
    const now = new Date();
    const diffMs = now.getTime() - lastCheck.getTime();
    if (diffMs < 60000) return "刚刚";
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} 分钟前`;
    return lastCheck.toLocaleTimeString();
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <Alert className="border-l-4">
        <Download className="h-4 w-4" />
        <AlertTitle>欢迎使用下载功能</AlertTitle>
        <AlertDescription>
          下载功能需要配置 qBittorrent API。如果您还没有安装
          qBittorrent，请先下载安装。
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://www.qbittorrent.org/download.php"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="mr-2 h-4 w-4" />
                下载 qBittorrent
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://github.com/qbittorrent/qBittorrent/wiki"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                查看文档
              </a>
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>连接状态</CardTitle>
            <CardDescription>与 qBittorrent 的 API 连接</CardDescription>
          </div>
          <Badge
            variant={isConnected ? "default" : "destructive"}
            className="gap-1"
          >
            {isConnected ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                已连接
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" />
                未连接
              </>
            )}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>最后检测: {formatLastCheck()}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={isTesting}
            >
              {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              测试连接
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>配置</CardTitle>
          <CardDescription>配置 qBittorrent API 连接信息</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="api_url"
                rules={{
                  required: "API 地址不能为空",
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: "请输入有效的 URL（如 http://localhost:8080）",
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API 地址</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="http://localhost:8080" />
                    </FormControl>
                    <FormDescription>
                      qBittorrent Web UI 地址，通常为 http://localhost:8080
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      <Input
                        type="password"
                        {...field}
                        placeholder="adminadmin"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={testConnection}
                  disabled={isTesting}
                >
                  {isTesting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  测试连接
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "保存中..." : "保存配置"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>故障排除</CardTitle>
          <CardDescription>配置连接时遇到的常见问题</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="banned">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  IP 被封禁怎么办？
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>IP 封禁</AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">
                      如果多次登录失败，qBittorrent 会临时封禁您的 IP 地址。
                    </p>
                    <p className="mb-2 font-medium">解决方法：</p>
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>
                        打开 qBittorrent Web UI（
                        <code className="bg-destructive/20 px-1 py-0.5 rounded">
                          {api_url}
                        </code>
                        ）
                      </li>
                      <li>
                        进入 <strong>工具 → 选项 → Web UI</strong>
                      </li>
                      <li>
                        点击 <strong>清除被禁用的 IP</strong> 按钮
                      </li>
                      <li>
                        （可选）取消勾选&quot;封禁 IP 地址失败登录超过 X
                        次的用户&quot;
                      </li>
                      <li>保存设置</li>
                    </ol>
                    <p className="mt-2 text-sm">
                      如果无法登录 Web UI，可以重启 qBittorrent 程序。
                    </p>
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="api-url">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  如何查找 qBittorrent API 地址？
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ol className="list-decimal ml-4 space-y-2">
                  <li>打开 qBittorrent 应用程序</li>
                  <li>
                    进入 <strong>工具 → 选项</strong>
                  </li>
                  <li>
                    切换到 <strong>Web UI</strong> 标签页
                  </li>
                  <li>查看&quot;端口&quot;设置，默认为 8080</li>
                  <li>
                    API 地址通常为：
                    <code className="bg-muted px-2 py-1 rounded ml-1">
                      http://localhost:{"{端口号}"}
                    </code>
                  </li>
                </ol>
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    如果 qBittorrent 在其他设备上运行，请使用该设备的 IP
                    地址，例如：
                    <code className="bg-muted px-1 py-0.5 rounded ml-1">
                      http://192.168.1.100:8080
                    </code>
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="examples">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  配置示例
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div>
                    <p className="font-medium mb-2">本地默认配置</p>
                    <code className="block bg-muted p-3 rounded text-sm whitespace-pre-wrap">
                      API 地址: http://localhost:8080 用户名: admin 密码:
                      （qBittorrent 安装时设置的密码）
                    </code>
                  </div>
                  <div>
                    <p className="font-medium mb-2">局域网配置</p>
                    <code className="block bg-muted p-3 rounded text-sm whitespace-pre-wrap">
                      API 地址: http://192.168.1.100:8080 用户名: admin 密码:
                      （qBittorrent Web UI 登录密码）
                    </code>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
