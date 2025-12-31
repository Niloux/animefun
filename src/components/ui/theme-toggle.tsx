import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { FC } from "react";
import { useEffect, useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const ThemeToggle: FC = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 避免服务端渲染不匹配
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex gap-0">
        <div className="w-10 h-10" />
        <div className="w-10 h-10" />
        <div className="w-10 h-10" />
      </div>
    );
  }

  return (
    <ToggleGroup
      type="single"
      value={theme}
      onValueChange={(value) => {
        if (value) setTheme(value);
      }}
      spacing={0}
      variant="outline"
    >
      <ToggleGroupItem
        value="light"
        aria-label="浅色模式"
        className="cursor-pointer"
      >
        <Sun className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="system"
        aria-label="跟随系统"
        className="cursor-pointer"
      >
        <Monitor className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="dark"
        aria-label="深色模式"
        className="cursor-pointer"
      >
        <Moon className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
};

export default ThemeToggle;
