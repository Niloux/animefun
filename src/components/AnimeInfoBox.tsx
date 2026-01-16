import React from "react";
import { Info } from "lucide-react";
import { InfoItem } from "../types/gen/bangumi";

interface AnimeInfoBoxProps {
  items?: InfoItem[];
}

const AnimeInfoBoxBase: React.FC<AnimeInfoBoxProps> = ({ items }) => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700 overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Info className="w-5 h-5 text-primary" />
        制作信息
      </h2>
      <div className="space-y-3">
        {items && items.length > 0 ? (
          items.map((info, idx) => (
            <div
              key={`${info.key}-${idx}`}
              className="flex justify-between items-start pb-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 last:pb-0 hover:bg-muted/30 p-2 -mx-2 rounded transition-colors"
            >
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                {info.key}:
              </span>
              <span className="text-sm text-gray-900 dark:text-white font-semibold text-right">
                {(info.values || []).join("、")}
              </span>
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            暂无制作信息
          </div>
        )}
      </div>
    </div>
  );
};

export const AnimeInfoBox = React.memo(AnimeInfoBoxBase);
