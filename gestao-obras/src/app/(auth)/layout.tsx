export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-lg font-semibold text-brand-900">Gestão de Obras</p>
          <p className="text-xs text-slate-500">Proposta técnica independente</p>
        </div>
        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
