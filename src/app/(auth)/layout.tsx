// Entrar, confirmar el código y completar el perfil: una columna de 480 px; en computador,
// una tarjeta sobre el fondo menta.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:py-12">
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-surface lg:min-h-0 lg:overflow-hidden lg:rounded-card lg:shadow-card">
        {children}
      </div>
    </div>
  );
}
