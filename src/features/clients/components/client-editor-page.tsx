import { SquarePen } from "lucide-react";
import { TopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";
import type { ClientProfile } from "../types/client";
import { ClientForm } from "./client-form";

// La página del editor de cliente (T-10.1.3, captura 62), para crear y para editar: "Editor de
// cliente" con el lápiz. Al crear vuelve a la lista; al editar, a la ficha.
export function ClientEditorPage({ client }: { client: ClientProfile | null }) {
  const back = client ? `/pro/clientes/${client.id}` : "/pro/clientes";
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Editor de cliente" icon={<SquarePen />} backHref={back} />
      <main className="mx-auto flex max-w-[720px] flex-col px-5 pb-24 pt-6 md:px-6">
        <ClientForm client={client} today={todayInBogota()} />
      </main>
    </div>
  );
}
