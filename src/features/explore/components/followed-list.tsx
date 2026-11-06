"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RatingSummary } from "@/shared/components/stars";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { toggleFollow } from "../services/actions";
import type { ExploreBusiness } from "../types/explore";
import { BusinessLogo } from "./business-logo";

export const NO_FOLLOWED = "Aún no sigues ningún negocio.";

function FollowedCard({
  business,
  onUnfollowed,
}: {
  business: ExploreBusiness;
  onUnfollowed: (id: string) => void;
}) {
  const hydrated = useHydrated();
  const [pending, startTransition] = useActionTransition();
  const unfollow = () => {
    startTransition(async () => {
      const result = await toggleFollow({ businessId: business.id });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      // Si ya no lo seguía (otra pestaña), el toque lo volvió a seguir: se deshace.
      if (result.data.following) {
        await toggleFollow({ businessId: business.id });
      }
      onUnfollowed(business.id);
    });
  };
  return (
    <li className="flex flex-col gap-2 rounded-card bg-surface p-3 shadow-card sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <BusinessLogo
          name={business.name}
          logoUrl={business.logoUrl}
          size={56}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            href={`/app/negocio/${business.id}`}
            className="relative z-[1] -my-[11px] py-[11px] text-16 font-bold text-primary hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {/* El relleno lo deja de 44 px para tocar sin mover la tarjeta (US-034). */}
            <span className="line-clamp-2">{business.name}</span>
          </Link>
          <RatingSummary score={business.score} reviews={business.reviews} />
          <span className="truncate text-14 text-slate">
            {[business.neighborhood, business.city].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={!hydrated || pending}
        onClick={unfollow}
        className="shrink-0 self-end sm:self-center"
      >
        Dejar de seguir
      </Button>
    </li>
  );
}

// Negocios seguidos (US-032): una tarjeta por negocio con "Dejar de seguir", que la quita al
// momento.
export function FollowedList({
  businesses,
}: {
  businesses: ExploreBusiness[];
}) {
  const [list, setList] = useState(businesses);
  if (list.length === 0) {
    return (
      <p role="status" className="py-16 text-center text-16 text-slate">
        {NO_FOLLOWED}
      </p>
    );
  }
  return (
    <ul className="mx-auto flex max-w-[720px] flex-col gap-3">
      {list.map((business) => (
        <FollowedCard
          key={business.id}
          business={business}
          onUnfollowed={(id) =>
            setList((items) => items.filter((item) => item.id !== id))
          }
        />
      ))}
    </ul>
  );
}
