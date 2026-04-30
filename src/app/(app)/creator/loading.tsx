
import { Skeleton } from "@/components/ui/skeleton";

export default function CreatorLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-pulse">
      <div className="text-center space-y-4">
        <Skeleton className="h-16 w-64 mx-auto rounded-full" />
        <Skeleton className="h-6 w-48 mx-auto rounded-full" />
      </div>
      <div className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl flex flex-col gap-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 ml-2" />
              <Skeleton className="h-16 w-full rounded-[1.5rem]" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 ml-2" />
              <Skeleton className="h-80 w-full rounded-[1.5rem]" />
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <Skeleton className="flex-1 min-h-[300px] rounded-[2.5rem]" />
            <Skeleton className="h-20 w-full rounded-[2.5rem]" />
          </div>
        </div>
      </div>
    </div>
  );
}
