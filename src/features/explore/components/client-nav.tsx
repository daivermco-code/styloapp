"use client";

import {
  BadgePercent,
  House,
  Map as MapIcon,
  Menu,
  Store,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/shared/components/brand-logo";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { CLIENT_MENU_LINKS, ClientMenu } from "./client-menu";
import { signInHref } from "./login-prompt";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { href: "/app", label: "Inicio", icon: House },
  { href: "/app/mapa", label: "Mapa", icon: MapIcon },
  { href: "/app/ofertas", label: "Ofertas", icon: BadgePercent },
  { href: "/app/negocios", label: "Negocios", icon: Store },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface ClientNavProps {
  signedIn: boolean;
  fullName: string | null;
}

// Barra inferior de la app de clientes (DESIGN.md §4): fija, 60 px, 5 botones; el activo en
// principal y los demás en gris pizarra. El quinto abre el menú (T-5.2.2). Desde 1024 px la
// reemplaza el menú lateral.
export function BottomNav({ signedIn, fullName }: ClientNavProps) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const [menuOpen, setMenuOpen] = useState(false);
  const inMenu = CLIENT_MENU_LINKS.some((link) =>
    isActive(pathname, link.href),
  );
  const itemClass = (active: boolean) =>
    cn(
      "flex h-full w-full flex-col items-center justify-center gap-0.5 text-11 font-bold",
      active ? "text-primary" : "text-slate",
    );

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid h-[60px] max-w-[720px] grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                <Icon className="size-6" strokeWidth={1.8} />
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-haspopup="dialog"
            disabled={!hydrated}
            onClick={() => setMenuOpen(true)}
            className={itemClass(inMenu)}
          >
            <Menu className="size-6" strokeWidth={1.8} />
            Menú
          </button>
        </li>
      </ul>
      <ClientMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        fullName={fullName}
        signedIn={signedIn}
        next={pathname}
      />
    </nav>
  );
}

const SIDE_ROW =
  "flex min-h-11 w-full items-center gap-3 rounded-card px-3 text-left text-16 text-ink transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function SideLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(SIDE_ROW, active && "bg-primary-50 font-bold text-primary")}
    >
      <Icon className="size-5 shrink-0 text-primary" strokeWidth={1.8} />
      {item.label}
    </Link>
  );
}

// Menú lateral de computador (desde 1024 px, DESIGN.md §5): las secciones y, debajo, lo personal
// con Cerrar sesión, o Entrar sin sesión.
export function SideNav({ signedIn, fullName }: ClientNavProps) {
  const pathname = usePathname();
  return (
    <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:p-5 lg:pb-20">
      <BrandLogo size={34} />
      <nav aria-label="Secciones" className="flex flex-col">
        {ITEMS.map((item) => (
          <SideLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
      <div className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-14 font-bold text-secondary">
          {signedIn ? (fullName ?? "Tu cuenta") : "Tu cuenta"}
        </p>
        {signedIn ? (
          <>
            <nav aria-label="Lo tuyo" className="flex flex-col">
              {CLIENT_MENU_LINKS.map((item) => (
                <SideLink key={item.href} item={item} pathname={pathname} />
              ))}
            </nav>
            <SignOutButton variant="ghost" className="self-start" />
          </>
        ) : (
          <Button asChild variant="outline" className="mx-3 self-start">
            <Link href={signInHref(pathname)}>Entrar</Link>
          </Button>
        )}
      </div>
    </aside>
  );
}
