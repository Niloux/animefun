import { FC } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSimpleQuery } from "@/hooks/use-simple-query";
import { getDownloaderConfig, setDownloaderConfig } from "@/lib/api";
import type { DownloaderConfig } from "@/types/gen/downloader_config";

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
    try {
      const configToSave: DownloaderConfig = {
        api_url: data.api_url,
        username: data.username || null,
        password: data.password || null,
      };
      await setDownloaderConfig(configToSave);
      toast.success("配置已保存");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (loading) {
    return <div className="p-4">加载中...</div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>下载器配置</CardTitle>
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
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "保存中..." : "保存配置"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
