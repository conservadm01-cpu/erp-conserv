import type { AiSettings, AppSettings } from "../core/types";
import { nowIso } from "../core/dates";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  questionsPerContent: 8,
  questionDifficultyMix: { facil: 40, medio: 40, dificil: 20 },
  level: "basico",
  tone: "didatico",
  gamesPerContent: 2,
  allowedGameTypes: ["qual_e_o_defeito", "monte_a_peca", "caca_ao_risco", "salve_a_maquina", "mestre_da_qualidade", "desafio_60s"],
  curiositiesPerContent: 4,
  lessonsPerContent: 4,
  challengesPerContent: 2,
  targetHours: 4,
  audience: "Colaboradores da produção",
  sector: "",
  jobFunction: "",
  competencies: [],
  allowedLibrarySourceIds: [],
  requireHumanReview: true,
  remoteProvider: { enabled: false, endpoint: "", model: "" },
};

export const LEGAL_DISCLAIMER =
  "Conteúdo educativo. Consulte a legislação e os responsáveis técnicos da empresa para aplicação específica.";

export const DEFAULT_SETTINGS: AppSettings = {
  id: "settings",
  brandName: "Academia ConServ",
  tagline: "Conhecimento que vira qualidade.",
  defaultPassScore: 70,
  rankingEnabled: false,
  certificateResponsible: "Coordenação de Treinamento — ConServ Confecções",
  certificateClassification: "Certificado de conclusão de treinamento interno",
  legalDisclaimer: LEGAL_DISCLAIMER,
  xpRules: {
    lesson: 20,
    quiz: 50,
    challenge: 100,
    course: 500,
    certificate: 1000,
    curiosity: 5,
    game: 80,
    riskReport: 60,
  },
  levels: [
    { level: 1, name: "Aprendiz", minXp: 0 },
    { level: 2, name: "Iniciante", minXp: 300 },
    { level: 3, name: "Operador", minXp: 800 },
    { level: 4, name: "Qualificado", minXp: 1600 },
    { level: 5, name: "Avançado", minXp: 3000 },
    { level: 6, name: "Especialista", minXp: 5200 },
    { level: 7, name: "Mestre ConServ", minXp: 8000 },
  ],
  ai: DEFAULT_AI_SETTINGS,
  erpIntegration: { enabled: false, baseUrl: "", apiKey: "" },
  updatedAt: nowIso(),
};
