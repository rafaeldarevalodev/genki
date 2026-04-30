
import { Skeleton } from "@/components/ui/skeleton";

export default function LibraryLoading() {
  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <Skeleton className="h-12 w-64 rounded-full" />
        <Skeleton className="h-16 w-full md:w-48 rounded-[2rem]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[280px] rounded-[2.5rem]" />
        ))}
      </div>
    </div>
  );
}
