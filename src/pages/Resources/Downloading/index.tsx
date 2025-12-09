import { FC, useState } from "react";
import { DownloadItem } from "@/types/gen/downloader";
import { HardDriveDownload } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDownloadList } from "@/hooks/use-download-list";
import { DownloadCard } from "../../../components/DownloadCard";

const ResourcesDownloadingPage: FC = () => {
  const { items, loading, handlePause, handleResume, handleDelete } =
    useDownloadList();
  const [itemToDelete, setItemToDelete] = useState<DownloadItem | null>(null);

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const success = await handleDelete(itemToDelete.hash);
    if (success) {
      setItemToDelete(null);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">Loading...</div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <HardDriveDownload className="w-16 h-16 mb-4 opacity-20" />
        <p>No active downloads</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Downloads</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <DownloadCard
              key={item.hash}
              item={item}
              onPause={() => handlePause(item.hash)}
              onResume={() => handleResume(item.hash)}
              onDelete={() => setItemToDelete(item)}
            />
          ))}
        </div>
      </div>

      <AlertDialog
        open={!!itemToDelete}
        onOpenChange={(open) => !open && setItemToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the task and all downloaded files for{" "}
              <span className="font-semibold text-foreground">
                {itemToDelete?.title}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ResourcesDownloadingPage;
