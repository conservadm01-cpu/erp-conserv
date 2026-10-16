import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-sm text-slate-600">O endereço não existe ou você não tem acesso a este registro.</p>
      <Link href="/" className="mt-6 inline-block text-sm text-brand-700 hover:underline">Voltar ao painel</Link>
    </main>
  );
}
