import { Calendar } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description: string;
  icon?: React.ElementType;
}

export const PageHeader = ({
  title,
  description,
  icon: Icon = Calendar,
}: PageHeaderProps) => {
  return (
    <div className="bg-linear-to-r from-background via-background to-primary/30 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50 w-full shadow-sm mb-6">
      <div className="flex flex-col p-4 gap-4 px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-linear-to-br from-blue-500 via-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30">
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-linear-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent leading-tight">
                {title}
              </h1>
              <div className="text-xs text-muted-foreground font-medium mt-0.5">
                {description}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
