import { Skeleton } from "@/components/ui/skeleton";

// Mientras llega el día (US-015: cambiar de día con esqueleto, nunca en blanco).
export function AgendaSkeleton({ list }: { list: boolean }) {
  if (list) {
    return (
      <div
        aria-label="Cargando la agenda"
        className="flex flex-col gap-2 px-4 pt-2 md:px-6"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[76px] rounded-booking" />
        ))}
      </div>
    );
  }
  return (
    <div
      aria-label="Cargando la agenda"
      className="grid min-h-0 flex-1 grid-cols-[56px_repeat(3,minmax(120px,1fr))] gap-x-2 overflow-hidden pr-2"
    >
      <span />
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex flex-col items-center gap-1 py-2">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
      <div className="flex flex-col gap-[102px] pt-1">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="mx-auto h-4 w-8" />
        ))}
      </div>
      {[40, 160, 90].map((offset) => (
        <div
          key={offset}
          className="flex flex-col gap-16"
          style={{ paddingTop: offset }}
        >
          <Skeleton className="h-[60px] rounded-booking" />
          <Skeleton className="h-[90px] rounded-booking" />
        </div>
      ))}
    </div>
  );
}
