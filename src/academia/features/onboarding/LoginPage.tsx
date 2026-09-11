import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { peopleRepo, settingsRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { Button } from "../../ui/primitives/Button";
import { Field, TextInput } from "../../ui/primitives/Field";
import { Icon } from "../../ui/primitives/Icon";
import { Avatar } from "../../ui/primitives/Avatar";
import { CharacterAvatar } from "../../ui/characters/Character";
import { ROLE_LABELS } from "../../auth/permissions";
import { Chip } from "../../ui/primitives/Chip";
import type { Employee, Role, User } from "../../core/types";

/**
 * A demonstração mostra UM perfil de cada papel, sempre nesta ordem.
 *
 * Antes a tela pegava os quatro primeiros usuários da coleção: como a
 * ordem de leitura do armazenamento não é garantida, a lista mudava a
 * cada recarregamento e às vezes nem aparecia um administrador.
 */
const PAPEIS_DEMONSTRACAO: Role[] = ["COLABORADOR", "INSTRUTOR", "GESTOR", "ADMIN"];

export function LoginPage() {
  const { login, loginAs } = useAuth();
  // Não há navegação após o login de propósito: a pessoa continua no
  // endereço que tentou abrir (link de curso compartilhado, QR Code,
  // aviso). Quem chegou pela raiz cai no painel normalmente.
  const settings = useQuery(() => settingsRepo.get());
  const perfis = useQuery<Array<{ user: User; employee: Employee }>>(() => {
    const candidatos = peopleRepo
      .users()
      .filter((user) => user.active)
      .map((user) => ({ user, employee: peopleRepo.employee(user.employeeId) }))
      .filter((item): item is { user: User; employee: Employee } => !!item.employee);
    const escolhidos: Array<{ user: User; employee: Employee }> = [];
    for (const papel of PAPEIS_DEMONSTRACAO) {
      const achado = candidatos.find((item) => item.user.role === papel);
      if (achado) escolhidos.push(achado);
    }
    // Sem nenhum papel reconhecido (base vindo de outro sistema), mostra
    // os primeiros mesmo assim para não travar o acesso.
    return escolhidos.length ? escolhidos : candidatos.slice(0, 4);
  });
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState<string>();

  const submit = () => {
    const result = login(form.login, form.password);
    if (!result.ok) setError(result.error);
  };

  return (
    <div className="min-h-[100dvh] bg-navy-900 text-linen-50 flex flex-col">
      <div className="flex-1 grid lg:grid-cols-2">
        {/* Apresentação */}
        <div className="relative p-6 sm:p-10 lg:p-14 flex flex-col justify-center overflow-hidden">
          <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-copper/20 blur-3xl" aria-hidden />
          <div className="absolute -left-20 bottom-0 w-72 h-72 rounded-full bg-jade/10 blur-3xl" aria-hidden />
          <div className="relative max-w-lg">
            <div className="flex items-center gap-3 mb-7">
              <span className="grid place-items-center w-12 h-12 rounded-2xl bg-copper text-linen-50 font-bold text-xl">A</span>
              <div>
                <div className="font-bold text-xl leading-tight">{settings.brandName}</div>
                <div className="text-[12.5px] text-sand-300">ConServ Confecções</div>
              </div>
            </div>
            <h1 className="text-[30px] sm:text-[40px] font-bold leading-[1.08] text-linen-50">
              Conhecimento que vira qualidade.
            </h1>
            <p className="text-[15.5px] text-linen-200/85 mt-4 leading-relaxed">
              Capacitação, segurança, qualidade e desenvolvimento profissional da ConServ, no seu ritmo —
              do celular do posto ao computador do escritório.
            </p>
            <div className="mt-8 flex items-start gap-4">
              <CharacterAvatar character="mestre" size={64} />
              <div className="rounded-2xl bg-linen-50/10 border border-linen-50/15 px-4 py-3 text-[14.5px] leading-relaxed">
                <strong className="block text-[11px] uppercase tracking-wide text-sand-300 mb-1">Mestre ConServ</strong>
                Você não está aqui apenas para aprender a operar uma máquina. Está aqui para se tornar um
                profissional que entende o que faz, por que faz e como fazer melhor.
              </div>
            </div>
            <div className="mt-7 grid grid-cols-3 gap-2.5 sm:gap-3 max-w-md">
              {[
                { icon: "compass", label: "17 trilhas" },
                { icon: "gamepad-2", label: "Jogos e desafios" },
                { icon: "award", label: "Certificados" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-linen-50/5 border border-linen-50/10 p-2.5 sm:p-3 text-center">
                  <Icon name={item.icon} size={20} className="mx-auto text-copper-300" />
                  <div className="text-[11px] sm:text-[11.5px] mt-1.5 text-linen-200/90 font-semibold leading-tight">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Acesso */}
        <div className="bg-linen text-ink p-6 sm:p-10 lg:p-14 flex flex-col justify-center">
          <div className="w-full max-w-md mx-auto">
            <h2 className="text-[22px] font-bold">Entrar na Academia</h2>
            <p className="text-[14px] text-ink-600 mt-1">Use seu acesso ConServ.</p>

            <div className="mt-6 space-y-4">
              <Field label="Usuário ou matrícula" required>
                <TextInput
                  value={form.login}
                  onChange={(e) => setForm({ ...form, login: e.target.value })}
                  placeholder="ex.: maria"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </Field>
              <Field label="Senha" required>
                <TextInput
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="••••"
                />
              </Field>
              {error && (
                <p className="text-[13px] font-semibold text-alert flex items-center gap-1.5">
                  <Icon name="alert" size={14} />
                  {error}
                </p>
              )}
              <Button size="lg" block icon="arrow-right" onClick={submit}>Entrar</Button>
            </div>

            <div className="mt-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="h-px flex-1 bg-sand" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Acesso de demonstração</span>
                <span className="h-px flex-1 bg-sand" />
              </div>
              <p className="text-[12.5px] text-ink-600 mb-3">
                Enquanto o acesso oficial não é configurado, toque em um perfil para entrar (senha <strong>1234</strong>).
              </p>
              <div className="space-y-2">
                {perfis.map(({ user, employee }) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => loginAs(user.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-sand bg-linen-50 hover:shadow-card transition-shadow text-left"
                  >
                    <Avatar name={employee.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold truncate">{employee.name}</div>
                      <div className="text-[12px] text-ink-600 truncate">{employee.cargo}</div>
                    </div>
                    <Chip tone={user.role === "ADMIN" ? "copper" : user.role === "COLABORADOR" ? "navy" : "jade"}>
                      {ROLE_LABELS[user.role]}
                    </Chip>
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-7 text-[11.5px] text-ink-400 leading-relaxed">
              A identificação por usuário e senha desta versão é um controle interno simples.
              Para dados sensíveis, conecte a autenticação definitiva (ver <code>auth/password.ts</code>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
