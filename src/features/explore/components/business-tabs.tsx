import Image from "next/image";
import { RatingSummary } from "@/shared/components/stars";
import type { WorkSample } from "../lib/samples";
import type { ExploreStaff } from "../types/explore";

// Pestaña Muestras de trabajo (US-026): imágenes fijas de la demo según el tipo de negocio.
export function SampleGrid({ samples }: { samples: WorkSample[] }) {
  return (
    <ul
      aria-label="Muestras de trabajo"
      className="grid grid-cols-2 gap-3 px-4 md:grid-cols-3 md:px-6"
    >
      {samples.map((sample) => (
        <li
          key={sample.src}
          className="overflow-hidden rounded-card bg-surface shadow-card"
        >
          <Image
            src={sample.src}
            alt={sample.caption}
            width={320}
            height={320}
            className="aspect-square w-full object-cover"
          />
          <p className="px-3 py-2 text-14 text-ink">{sample.caption}</p>
        </li>
      ))}
    </ul>
  );
}

// Pestaña Profesionales (US-026, captura 192): cada uno con su inicial y su calificación.
export function StaffList({ staff }: { staff: ExploreStaff[] }) {
  if (staff.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-14 text-slate">
        Este negocio todavía no tiene profesionales en la app.
      </p>
    );
  }
  return (
    <ul aria-label="Profesionales" className="flex flex-col px-4 md:px-6">
      {staff.map((person) => (
        <li
          key={person.id}
          className="flex items-center gap-4 border-b border-line py-3"
        >
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-20 font-bold text-surface"
          >
            {person.name.charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-16 font-bold text-ink">
              {person.name}
            </span>
            <RatingSummary score={person.score} reviews={person.reviews} />
          </span>
        </li>
      ))}
    </ul>
  );
}
