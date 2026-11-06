import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayMonth } from "@/shared/lib/dates";
import type { Follower } from "../types/report";

const CARD = "rounded-sheet border border-line bg-surface";

// Lista de seguidores (T-14.1.2, US-058, captura 40): el título en 16 petróleo profundo centrado y
// cada seguidor con su inicial, el nombre y desde cuándo sigue al negocio, del más reciente al
// más antiguo. Ni celular ni nada más (Tech Spec O5.5).
export function FollowersList({ followers }: { followers: Follower[] }) {
  return (
    <section aria-label="Lista de seguidores" className={CARD}>
      <h2 className="px-5 pb-2 pt-4 text-center text-16 text-secondary">
        Lista de seguidores
      </h2>
      {followers.length === 0 ? (
        <p className="px-5 pb-6 pt-2 text-14 text-slate">
          Aún no tienes seguidores
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {followers.map((follower, index) => (
            <li
              key={`${follower.followedAt}-${index}`}
              className="flex min-h-16 items-center gap-3 px-5 py-3"
            >
              <Avatar className="size-10 text-16">
                <AvatarFallback>{follower.fullName.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-16 text-ink">
                {follower.fullName}
              </span>
              <span className="shrink-0 text-12 text-slate">
                Te sigue desde el {formatDayMonth(follower.followedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FollowersListSkeleton() {
  return (
    <div
      className={`${CARD} flex flex-col gap-3 p-5`}
      aria-busy="true"
      aria-label="Cargando los seguidores"
    >
      <Skeleton className="mx-auto h-5 w-40" />
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} className="h-12" />
      ))}
    </div>
  );
}
