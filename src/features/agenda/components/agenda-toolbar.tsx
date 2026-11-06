"use client";

import { usePathname } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { DayStrip } from "@/shared/components/day-strip";
import { useInstantNav, usePendingHref } from "@/shared/components/instant-nav";
import { NAV_GROUP, paramOf } from "@/shared/lib/instant-nav";

interface AgendaToolbarProps {
  day: string;
  today: string;
  list: boolean;
}

// Barra de días y el interruptor de la lista (captura 169). El día y la vista van en la URL
// (?dia=2026-11-01&vista=lista), así se pueden recargar y compartir. Responden al tocarlos (Fase
// 17): mientras llega el día o la vista, se ven ya cambiados y la grilla sale en esqueleto.
export function AgendaToolbar({ day, today, list }: AgendaToolbarProps) {
  const pathname = usePathname();
  const { navigate } = useInstantNav();
  const asked = usePendingHref(NAV_GROUP.agenda);
  const shownDay = (asked && paramOf(asked, "dia")) || day;
  const shownList = asked ? paramOf(asked, "vista") === "lista" : list;

  function go(nextDay: string, nextList: boolean) {
    const params = new URLSearchParams({ dia: nextDay });
    if (nextList) params.set("vista", "lista");
    navigate(`${pathname}?${params}`, NAV_GROUP.agenda);
  }

  return (
    <div className="flex flex-col gap-2 border-b border-line bg-surface pt-3">
      <DayStrip
        selected={shownDay}
        today={today}
        onSelect={(nextDay) => go(nextDay, shownList)}
      />
      <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 px-5 text-14 text-ink">
        <Switch
          checked={shownList}
          onCheckedChange={(checked) => go(shownDay, checked)}
        />
        Cambiar a vista de lista
      </label>
    </div>
  );
}
