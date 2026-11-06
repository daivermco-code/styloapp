"use client";

import Link from "next/link";
import { toast } from "sonner";
import type { StaffSide } from "../types/home";
import {
  type HomeModule,
  OWNER_SECTIONS,
  SOON_MESSAGE,
  STAFF_SECTIONS,
} from "./module-list";

const ITEM =
  "flex min-h-20 w-full flex-col items-center justify-start gap-1.5 rounded-card px-1 py-2 text-center text-16 leading-tight text-ink transition-colors duration-120 hover:bg-primary-50";

function ModuleItem({ module }: { module: HomeModule }) {
  const content = (
    <>
      <module.icon className="size-[30px] text-primary" strokeWidth={1.8} />
      {module.label}
    </>
  );
  if (module.href) {
    return (
      <Link href={module.href} className={ITEM}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => toast(SOON_MESSAGE, { id: "pronto" })}
      className={ITEM}
    >
      {content}
    </button>
  );
}

// Los módulos del inicio en tarjetas de 3 columnas (4 en tableta). En computador viven en el
// menú lateral (UI pantalla 2).
export function ModuleGrid({ side }: { side: StaffSide }) {
  const sections = side === "owner" ? OWNER_SECTIONS : STAFF_SECTIONS;
  return (
    <div className="flex flex-col gap-8 px-5 pt-8">
      {sections.map((section, index) => (
        <section
          key={section.title ?? index}
          aria-label={section.title ?? undefined}
          className="flex flex-col gap-3"
        >
          {section.title && (
            <h2 className="text-22 font-bold text-primary">{section.title}</h2>
          )}
          <ul className="grid grid-cols-3 gap-x-2 gap-y-3 rounded-card bg-surface px-3 py-6 shadow-card md:grid-cols-4">
            {section.modules.map((module) => (
              <li key={module.label}>
                <ModuleItem module={module} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
