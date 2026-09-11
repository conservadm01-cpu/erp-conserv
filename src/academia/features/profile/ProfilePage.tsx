import { certificateRepo, competencyRepo, gamificationRepo, learningRepo, notificationRepo, peopleRepo, settingsRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { xpEngine } from "../../engines/gamification/XpEngine";
import { competencyEngine } from "../../engines/competency/CompetencyEngine";
import { badgeEngine } from "../../engines/gamification/BadgeEngine";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, SectionTitle } from "../../ui/primitives/Card";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { Avatar } from "../../ui/primitives/Avatar";
import { Toggle } from "../../ui/primitives/Field";
import { StatTile } from "../../ui/primitives/Feedback";
import { Button } from "../../ui/primitives/Button";
import { formatDate, relativeFrom, yearsSince } from "../../core/dates";
import { ROLE_LABELS } from "../../auth/permissions";
import { cn } from "../../core/cn";

export function ProfilePage() {
  const { employee, role } = useAuth();
  const { navigate } = useRouter();
  const settings = useQuery(() => settingsRepo.get());

  const data = useQuery(() => {
    if (!employee) return null;
    return {
      level: xpEngine.level(employee.id),
      badges: gamificationRepo.badgesOf(employee.id),
      pendingBadges: badgeEngine.pending(employee.id),
      certificates: certificateRepo.ofEmployee(employee.id),
      enrollments: learningRepo.enrollmentsOf(employee.id),
      xpHistory: gamificationRepo.xpOf(employee.id).slice(0, 12),
      competencies: competencyRepo.ofEmployee(employee.id).sort((a, b) => b.level - a.level),
      supervisor: employee.supervisorId ? peopleRepo.employee(employee.supervisorId) : undefined,
      department: peopleRepo.departmentName(employee.departmentId),
      jobRole: peopleRepo.jobRoleName(employee.jobRoleId),
      lessonsDone: learningRepo.progressOf(employee.id).filter((p) => p.status === "concluido").length,
      attempts: learningRepo.quizAttempts(employee.id),
      games: learningRepo.gameSessions(employee.id),
      unread: notificationRepo.unreadCount(employee.id, role ?? undefined),
    };
  }, [employee?.id, role]);

  if (!employee || !data) return null;
  const avgScore = data.attempts.length === 0 ? 0 : Math.round(data.attempts.reduce((s, a) => s + a.score, 0) / data.attempts.length);

  return (
    <div>
      <PageHeader title="Meu perfil" subtitle="Seu histórico, suas conquistas e suas preferências." icon="user" />

      <Card className="p-5 mb-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={employee.name} photoUrl={employee.photoUrl} size={72} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] font-bold leading-tight">{employee.name}</h2>
            <p className="text-[14px] text-ink-600">{employee.cargo} · {data.department}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Chip tone="navy">Matrícula {employee.code}</Chip>
              <Chip tone="sand">{data.jobRole}</Chip>
              <Chip tone="neutral">{ROLE_LABELS[role ?? "COLABORADOR"]}</Chip>
              <Chip tone="jade">Nível {data.level.level} · {data.level.name}</Chip>
            </div>
            <p className="text-[12.5px] text-ink-400 mt-2">
              Na ConServ desde {formatDate(employee.admissionDate)} ({yearsSince(employee.admissionDate)} ano(s))
              {data.supervisor ? ` · supervisão: ${data.supervisor.name}` : ""}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatTile label="XP acumulado" value={data.level.xp} icon="zap" accent="copper" />
        <StatTile label="Aulas concluídas" value={data.lessonsDone} icon="book-open" />
        <StatTile label="Média nos quizzes" value={`${avgScore}%`} icon="clipboard" accent="jade" />
        <StatTile label="Certificados" value={data.certificates.length} icon="award" accent="sand" onClick={() => navigate("/certificados")} />
      </div>

      <section className="mb-6">
        <SectionTitle hint="Conquistas são reconhecimento de esforço — nunca comparação forçada.">Badges</SectionTitle>
        <Card className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-3">
            {data.badges.map((earned) => {
              const badge = gamificationRepo.badge(earned.badgeId);
              if (!badge) return null;
              return (
                <div key={earned.id} className="text-center p-3 rounded-xl border border-copper/25 bg-copper/5">
                  <span className="inline-grid place-items-center w-11 h-11 rounded-xl bg-copper text-linen-50 mb-1.5">
                    <Icon name={badge.icon} size={22} />
                  </span>
                  <div className="text-[13px] font-bold leading-snug">{badge.name}</div>
                  <div className="text-[11px] text-ink-600 mt-0.5">{relativeFrom(earned.earnedAt)}</div>
                </div>
              );
            })}
            {data.pendingBadges.slice(0, 6).map((badge) => (
              <div key={badge.id} className="text-center p-3 rounded-xl border border-sand bg-linen-100/60 opacity-75">
                <span className="inline-grid place-items-center w-11 h-11 rounded-xl bg-sand/40 text-ink-600 mb-1.5">
                  <Icon name="lock" size={20} />
                </span>
                <div className="text-[13px] font-semibold leading-snug">{badge.name}</div>
                <div className="text-[11px] text-ink-600 mt-0.5 leading-snug">{badge.description}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card className="p-4">
          <SectionTitle>Competências em destaque</SectionTitle>
          <ul className="space-y-2">
            {data.competencies.slice(0, 6).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3">
                <span className="text-[14px] truncate">{competencyRepo.name(entry.competencyId)}</span>
                <Chip tone={entry.level >= 5 ? "jade" : entry.level >= 3 ? "navy" : "neutral"}>
                  {competencyEngine.levelName(entry.level)}
                </Chip>
              </li>
            ))}
            {data.competencies.length === 0 && <li className="text-[13.5px] text-ink-600">Nenhuma competência avaliada ainda.</li>}
          </ul>
          <Button size="sm" variant="secondary" className="mt-3" icon="target" onClick={() => navigate("/competencias")}>
            Ver matriz completa
          </Button>
        </Card>

        <Card className="p-4">
          <SectionTitle>Histórico de XP</SectionTitle>
          <ul className="space-y-1.5">
            {data.xpHistory.map((transaction) => (
              <li key={transaction.id} className="flex items-center justify-between gap-3 text-[13.5px]">
                <span className="truncate">{transaction.reason}</span>
                <span className={cn("shrink-0 font-bold tabular-nums", transaction.amount >= 0 ? "text-jade-600" : "text-alert")}>
                  +{transaction.amount}
                </span>
              </li>
            ))}
            {data.xpHistory.length === 0 && <li className="text-[13.5px] text-ink-600">Sem movimentos ainda.</li>}
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle hint="Sua escolha. Ninguém é exposto sem autorização.">Preferências</SectionTitle>
        <Card className="p-4 space-y-4">
          <Toggle
            checked={employee.preferences.rankingOptIn}
            onChange={(value) => peopleRepo.patchEmployee(employee.id, { preferences: { ...employee.preferences, rankingOptIn: value } })}
            label="Participar do ranking de XP"
            hint={settings.rankingEnabled
              ? "Seu nome e XP aparecem no ranking interno da Academia."
              : "O ranking está desativado pela empresa. Sua escolha fica registrada para quando for ativado."}
          />
          <Toggle
            checked={employee.preferences.notifications}
            onChange={(value) => peopleRepo.patchEmployee(employee.id, { preferences: { ...employee.preferences, notifications: value } })}
            label="Receber avisos da Academia"
            hint="Conquistas, recomendações e treinamentos obrigatórios."
          />
          {data.unread > 0 && (
            <Button size="sm" variant="secondary" icon="info" onClick={() => navigate("/notificacoes")}>
              Ver {data.unread} aviso(s) não lido(s)
            </Button>
          )}
        </Card>
      </section>
    </div>
  );
}

export function NotificationsPage() {
  const { employee, role } = useAuth();
  const { navigate } = useRouter();
  const notifications = useQuery(
    () => (employee ? notificationRepo.forEmployee(employee.id, role ?? undefined) : []),
    [employee?.id, role],
  );

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Avisos"
        subtitle="Conquistas, recomendações e pendências."
        icon="info"
        action={employee && notifications.some((n) => !n.read)
          ? <Button size="sm" variant="secondary" icon="check" onClick={() => notificationRepo.markAllRead(employee.id)}>Marcar tudo como lido</Button>
          : undefined}
      />
      <div className="space-y-2">
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            className={cn("p-4", !notification.read && "border-copper/30 bg-copper/5")}
            interactive={!!notification.link}
            onClick={() => {
              notificationRepo.markRead(notification.id);
              if (notification.link) navigate(notification.link);
            }}
          >
            <div className="flex items-start gap-3">
              <span className={cn(
                "shrink-0 grid place-items-center w-9 h-9 rounded-xl border",
                notification.kind === "conquista" ? "bg-copper/15 text-copper-600 border-copper/25"
                  : notification.kind === "risco" ? "bg-alert/10 text-alert border-alert/25"
                  : "bg-navy/10 text-navy border-navy/20",
              )}>
                <Icon name={notification.kind === "conquista" ? "trophy" : notification.kind === "risco" ? "siren" : "info"} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-[14.5px] leading-snug">{notification.title}</h3>
                <p className="text-[13.5px] text-ink-600 mt-0.5 leading-snug">{notification.body}</p>
                <p className="text-[11.5px] text-ink-400 mt-1">{relativeFrom(notification.createdAt)}</p>
              </div>
              {!notification.read && <span className="shrink-0 w-2 h-2 rounded-full bg-copper mt-2" />}
            </div>
          </Card>
        ))}
        {notifications.length === 0 && (
          <Card className="p-6 text-center text-[14px] text-ink-600">Nenhum aviso por aqui.</Card>
        )}
      </div>
    </div>
  );
}
