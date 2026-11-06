import { getCurrentPerson } from "@/features/auth/services/queries";
import { BottomNav, SideNav } from "@/features/explore/components/client-nav";

// App de clientes: cada página trae su barra superior. En el celular y la tableta vertical, la
// barra inferior de 5 botones queda fija y el contenido en una columna de 720 px; desde 1024 px,
// menú lateral de 260 px y el contenido al centro, hasta 960 px (DESIGN.md §5).
export default async function ClientLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const person = await getCurrentPerson();
  const nav = { signedIn: person !== null, fullName: person?.fullName ?? null };

  return (
    <div className="min-h-dvh pb-[calc(60px+env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[260px_1fr] lg:pb-0">
      <SideNav {...nav} />
      <div className="min-w-0">
        <div className="mx-auto max-w-[720px] lg:max-w-[960px]">{children}</div>
      </div>
      <BottomNav {...nav} />
    </div>
  );
}
