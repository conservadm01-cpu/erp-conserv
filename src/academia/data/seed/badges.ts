import type { Badge } from "../../core/types";

/**
 * Badges (seção 15). Regras são declarativas: o BadgeEngine avalia
 * `rule` contra a atividade do colaborador — criar um badge novo pelo
 * painel não exige mexer em código.
 * Gamificação aqui reconhece esforço; nunca serve para constranger.
 */
export const SEED_BADGES: Badge[] = [
  { id: "BDG-01", code: "PRIMEIRO-CURSO", name: "Primeiro Curso", description: "Você concluiu seu primeiro curso na Academia ConServ.", icon: "award", tier: "bronze", xp: 100, rule: { kind: "first_course" }, active: true },
  { id: "BDG-02", code: "MESTRE-COSTURA", name: "Mestre da Costura", description: "Nível 5 ou mais em Máquina Reta — referência no setor.", icon: "scissors", tier: "ouro", xp: 300, rule: { kind: "competency_level", competencyId: "CMP-RETA", level: 5 }, active: true },
  { id: "BDG-03", code: "OLHO-DE-AGUIA", name: "Olho de Águia", description: "Encontrou todos os defeitos em uma partida de Mestre da Qualidade.", icon: "eye", tier: "prata", xp: 150, rule: { kind: "games_passed", gameType: "mestre_da_qualidade", count: 1 }, active: true },
  { id: "BDG-04", code: "GUARDIAO-QUALIDADE", name: "Guardião da Qualidade", description: "Concluiu o curso de Qualidade e acertou 90% ou mais na avaliação.", icon: "shield-check", tier: "ouro", xp: 250, rule: { kind: "quiz_score", min: 90, count: 1 }, active: true },
  { id: "BDG-05", code: "CACADOR-RISCOS", name: "Caçador de Riscos", description: "Reportou 3 riscos pelo botão “Eu vi um risco”.", icon: "siren", tier: "prata", xp: 200, rule: { kind: "risk_reports", count: 3 }, active: true },
  { id: "BDG-06", code: "MESTRE-REGULAGEM", name: "Mestre da Regulagem", description: "Nível 4 ou mais em Regulagem de Máquina.", icon: "settings", tier: "ouro", xp: 250, rule: { kind: "competency_level", competencyId: "CMP-REGULAGEM", level: 4 }, active: true },
  { id: "BDG-07", code: "CINCO-S", name: "5S", description: "Concluiu a trilha 5S e Organização.", icon: "sparkles", tier: "prata", xp: 150, rule: { kind: "path_completed", pathId: "PTH-15" }, active: true },
  { id: "BDG-08", code: "SEM-RETRABALHO", name: "Sem Retrabalho", description: "Acertou 10 desafios práticos — decisão certa antes do problema virar retrabalho.", icon: "check-circle", tier: "prata", xp: 200, rule: { kind: "challenges_correct", count: 10 }, active: true },
  { id: "BDG-09", code: "ESPECIALISTA", name: "Especialista", description: "Acumulou 5.000 XP na Academia.", icon: "star", tier: "mestre", xp: 500, rule: { kind: "xp_total", amount: 5000 }, active: true },
  { id: "BDG-10", code: "CURIOSO", name: "Curioso", description: "Leu 15 curiosidades da fábrica.", icon: "lightbulb", tier: "bronze", xp: 80, rule: { kind: "curiosities_read", count: 15 }, active: true },
  { id: "BDG-11", code: "MARATONISTA", name: "Maratonista", description: "Concluiu 25 aulas.", icon: "flag", tier: "prata", xp: 180, rule: { kind: "lessons_completed", count: 25 }, active: true },
  { id: "BDG-12", code: "NOTA-MAXIMA", name: "Nota Máxima", description: "Fez 100% em uma avaliação.", icon: "target", tier: "ouro", xp: 220, rule: { kind: "perfect_quiz", count: 1 }, active: true },
  { id: "BDG-13", code: "TRES-CURSOS", name: "Trilha Firme", description: "Concluiu 3 cursos.", icon: "layers", tier: "prata", xp: 200, rule: { kind: "courses_completed", count: 3 }, active: true },
  { id: "BDG-14", code: "GUARDIAO-SEGURANCA", name: "Guardião da Segurança", description: "Nível 3 ou mais em NR-1 e GRO.", icon: "shield", tier: "ouro", xp: 240, rule: { kind: "competency_level", competencyId: "CMP-NR1", level: 3 }, active: true },
];
