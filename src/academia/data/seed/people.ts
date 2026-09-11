import type { Department, Employee, JobRole, User } from "../../core/types";
import { hashPassword } from "../../auth/password";
import { initialsOf } from "../../core/cn";

export const SEED_DEPARTMENTS: Department[] = [
  { id: "DEP-CORTE", code: "CORTE", name: "Corte", description: "Enfesto, risco, corte, identificação e separação de lotes." },
  { id: "DEP-PREP", code: "PREP", name: "Preparação", description: "Separação, entretelagem, travetes e preparo para a costura." },
  { id: "DEP-COSTURA", code: "COST", name: "Costura", description: "Montagem das peças: reta, overloque, galoneira e interlock." },
  { id: "DEP-ESTAMPARIA", code: "EST", name: "Estamparia", description: "Silk screen, DTF e sublimação." },
  { id: "DEP-MODELAGEM", code: "MOD", name: "Modelagem", description: "Medidas, moldes, graduação e ficha técnica." },
  { id: "DEP-QUALIDADE", code: "QUAL", name: "Qualidade", description: "Revisão, inspeção e tratamento de defeitos." },
  { id: "DEP-EMBALAGEM", code: "EMB", name: "Embalagem e Expedição", description: "Conferência, dobra, etiqueta, lote e expedição." },
  { id: "DEP-MANUTENCAO", code: "MAN", name: "Manutenção", description: "Manutenção preventiva e corretiva de máquinas." },
  { id: "DEP-ADM", code: "ADM", name: "Administração", description: "Coordenação, treinamento, segurança do trabalho e gestão." },
];

export const SEED_JOB_ROLES: JobRole[] = [
  {
    id: "FUN-COSTUREIRA", name: "Costureira / Costureiro", departmentId: "DEP-COSTURA",
    description: "Monta as peças conforme ficha técnica, sequência operacional e padrão de qualidade.",
    targets: [
      { competencyId: "CMP-RETA", level: 4 },
      { competencyId: "CMP-OVERLOQUE", level: 4 },
      { competencyId: "CMP-GALONEIRA", level: 3 },
      { competencyId: "CMP-REGULAGEM", level: 3 },
      { competencyId: "CMP-AGULHA-LINHA", level: 3 },
      { competencyId: "CMP-QUALIDADE", level: 3 },
      { competencyId: "CMP-SEQ-OPERACIONAL", level: 3 },
      { competencyId: "CMP-FICHA-TECNICA", level: 3 },
      { competencyId: "CMP-ERGONOMIA", level: 3 },
      { competencyId: "CMP-NR1", level: 2 },
      { competencyId: "CMP-5S", level: 3 },
      { competencyId: "CMP-MANUTENCAO", level: 2 },
      { competencyId: "CMP-PRODUTIVIDADE", level: 3 },
    ],
  },
  {
    id: "FUN-CORTADOR", name: "Cortador / Cortadora", departmentId: "DEP-CORTE",
    description: "Executa enfesto, risco e corte com aproveitamento e identificação correta dos lotes.",
    targets: [
      { competencyId: "CMP-ENFESTO", level: 4 },
      { competencyId: "CMP-RISCO-ENCAIXE", level: 4 },
      { competencyId: "CMP-CORTE-MAQUINA", level: 4 },
      { competencyId: "CMP-APROVEITAMENTO", level: 4 },
      { competencyId: "CMP-FICHA-TECNICA", level: 3 },
      { competencyId: "CMP-NR1", level: 3 },
      { competencyId: "CMP-PERIGO-RISCO", level: 3 },
      { competencyId: "CMP-5S", level: 3 },
      { competencyId: "CMP-SUSTENTABILIDADE", level: 2 },
    ],
  },
  {
    id: "FUN-PREPARADOR", name: "Auxiliar de Preparação", departmentId: "DEP-PREP",
    description: "Separa, confere e prepara o corte para a costura.",
    targets: [
      { competencyId: "CMP-SEQ-OPERACIONAL", level: 3 },
      { competencyId: "CMP-FICHA-TECNICA", level: 2 },
      { competencyId: "CMP-QUALIDADE", level: 3 },
      { competencyId: "CMP-5S", level: 3 },
      { competencyId: "CMP-ERGONOMIA", level: 2 },
      { competencyId: "CMP-NR1", level: 2 },
    ],
  },
  {
    id: "FUN-ESTAMPADOR", name: "Estampador / Estampadora", departmentId: "DEP-ESTAMPARIA",
    description: "Prepara telas, imprime, cura e controla a qualidade da estampa.",
    targets: [
      { competencyId: "CMP-SILK-TELA", level: 4 },
      { competencyId: "CMP-SILK-IMPRESSAO", level: 4 },
      { competencyId: "CMP-DTF", level: 3 },
      { competencyId: "CMP-SUBLIMACAO", level: 3 },
      { competencyId: "CMP-QUALIDADE", level: 3 },
      { competencyId: "CMP-NR1", level: 3 },
      { competencyId: "CMP-PERIGO-RISCO", level: 3 },
      { competencyId: "CMP-5S", level: 3 },
    ],
  },
  {
    id: "FUN-MODELISTA", name: "Modelista", departmentId: "DEP-MODELAGEM",
    description: "Constrói e gradua moldes, define margens e escreve a ficha técnica.",
    targets: [
      { competencyId: "CMP-MODELAGEM", level: 5 },
      { competencyId: "CMP-GRADUACAO", level: 5 },
      { competencyId: "CMP-MARGEM-COSTURA", level: 4 },
      { competencyId: "CMP-FICHA-TECNICA", level: 5 },
      { competencyId: "CMP-RISCO-ENCAIXE", level: 3 },
      { competencyId: "CMP-APROVEITAMENTO", level: 3 },
    ],
  },
  {
    id: "FUN-REVISOR", name: "Revisor(a) de Qualidade", departmentId: "DEP-QUALIDADE",
    description: "Inspeciona peças, classifica defeitos e devolve informação para a produção.",
    targets: [
      { competencyId: "CMP-QUALIDADE", level: 5 },
      { competencyId: "CMP-DEFEITOS", level: 5 },
      { competencyId: "CMP-RETRABALHO", level: 4 },
      { competencyId: "CMP-FICHA-TECNICA", level: 4 },
      { competencyId: "CMP-COMUNICACAO", level: 4 },
      { competencyId: "CMP-REGULAGEM", level: 3 },
    ],
  },
  {
    id: "FUN-EMBALADOR", name: "Auxiliar de Embalagem", departmentId: "DEP-EMBALAGEM",
    description: "Confere, dobra, identifica, embala e prepara a expedição.",
    targets: [
      { competencyId: "CMP-EMBALAGEM", level: 4 },
      { competencyId: "CMP-QUALIDADE", level: 3 },
      { competencyId: "CMP-5S", level: 3 },
      { competencyId: "CMP-ERGONOMIA", level: 2 },
      { competencyId: "CMP-COMUNICACAO", level: 2 },
    ],
  },
  {
    id: "FUN-MECANICO", name: "Mecânico(a) de Máquinas", departmentId: "DEP-MANUTENCAO",
    description: "Faz manutenção preventiva e corretiva, regula e treina operadores.",
    targets: [
      { competencyId: "CMP-MANUTENCAO", level: 5 },
      { competencyId: "CMP-REGULAGEM", level: 6 },
      { competencyId: "CMP-NR1", level: 4 },
      { competencyId: "CMP-PERIGO-RISCO", level: 4 },
      { competencyId: "CMP-AGULHA-LINHA", level: 4 },
    ],
  },
  {
    id: "FUN-SUPERVISOR", name: "Supervisor(a) de Produção", departmentId: "DEP-ADM",
    description: "Conduz a equipe, acompanha metas, qualidade, segurança e desenvolvimento.",
    targets: [
      { competencyId: "CMP-PRODUTIVIDADE", level: 5 },
      { competencyId: "CMP-QUALIDADE", level: 4 },
      { competencyId: "CMP-NR1", level: 4 },
      { competencyId: "CMP-PSICOSSOCIAL", level: 4 },
      { competencyId: "CMP-COMUNICACAO", level: 5 },
      { competencyId: "CMP-CULTURA", level: 5 },
      { competencyId: "CMP-DESENVOLVIMENTO", level: 4 },
    ],
  },
  {
    id: "FUN-COORD-TREINAMENTO", name: "Coordenação de Treinamento", departmentId: "DEP-ADM",
    description: "Planeja, produz e aprova o conteúdo da Academia ConServ.",
    targets: [
      { competencyId: "CMP-DESENVOLVIMENTO", level: 5 },
      { competencyId: "CMP-CULTURA", level: 5 },
      { competencyId: "CMP-NR1", level: 4 },
      { competencyId: "CMP-COMUNICACAO", level: 5 },
    ],
  },
];

function employee(e: Omit<Employee, "initials" | "preferences" | "createdAt" | "status"> & Partial<Employee>): Employee {
  return {
    status: "ativo",
    initials: initialsOf(e.name),
    preferences: { rankingOptIn: false, notifications: true },
    createdAt: e.admissionDate,
    ...e,
  } as Employee;
}

export const SEED_EMPLOYEES: Employee[] = [
  employee({
    id: "EMP-0001", code: "0142", name: "Maria Aparecida Silva", departmentId: "DEP-COSTURA", jobRoleId: "FUN-COSTUREIRA",
    cargo: "Costureira II", admissionDate: "2019-03-11", supervisorId: "EMP-0008", professionalLevel: "qualificado",
    shift: "integral", preferences: { rankingOptIn: true, notifications: true },
  }),
  employee({
    id: "EMP-0002", code: "0187", name: "Joana Ribeiro dos Santos", departmentId: "DEP-COSTURA", jobRoleId: "FUN-COSTUREIRA",
    cargo: "Costureira I", admissionDate: "2024-08-05", supervisorId: "EMP-0008", professionalLevel: "iniciante", shift: "manha",
  }),
  employee({
    id: "EMP-0003", code: "0093", name: "Antônio Carlos Pereira", departmentId: "DEP-CORTE", jobRoleId: "FUN-CORTADOR",
    cargo: "Cortador III", admissionDate: "2015-06-22", supervisorId: "EMP-0008", professionalLevel: "especialista", shift: "integral",
  }),
  employee({
    id: "EMP-0004", code: "0231", name: "Luciana Gomes de Araújo", departmentId: "DEP-ESTAMPARIA", jobRoleId: "FUN-ESTAMPADOR",
    cargo: "Estampadora II", admissionDate: "2022-02-14", supervisorId: "EMP-0008", professionalLevel: "operacional", shift: "tarde",
  }),
  employee({
    id: "EMP-0005", code: "0256", name: "Rafael Moreira Lima", departmentId: "DEP-QUALIDADE", jobRoleId: "FUN-REVISOR",
    cargo: "Revisor de Qualidade", admissionDate: "2021-10-01", supervisorId: "EMP-0008", professionalLevel: "avancado", shift: "integral",
  }),
  employee({
    id: "EMP-0006", code: "0274", name: "Cleide Nascimento Barros", departmentId: "DEP-EMBALAGEM", jobRoleId: "FUN-EMBALADOR",
    cargo: "Auxiliar de Embalagem", admissionDate: "2023-05-18", supervisorId: "EMP-0008", professionalLevel: "operacional", shift: "tarde",
  }),
  employee({
    id: "EMP-0007", code: "0061", name: "Sebastião Ferreira Rocha", departmentId: "DEP-MANUTENCAO", jobRoleId: "FUN-MECANICO",
    cargo: "Mecânico de Máquinas", admissionDate: "2012-09-03", supervisorId: "EMP-0008", professionalLevel: "especialista", shift: "integral",
  }),
  employee({
    id: "EMP-0008", code: "0020", name: "Patrícia Almeida Souza", departmentId: "DEP-ADM", jobRoleId: "FUN-SUPERVISOR",
    cargo: "Supervisora de Produção", admissionDate: "2016-01-25", professionalLevel: "especialista", shift: "integral",
  }),
  employee({
    id: "EMP-0009", code: "0005", name: "Coordenação de Treinamento ConServ", departmentId: "DEP-ADM", jobRoleId: "FUN-COORD-TREINAMENTO",
    cargo: "Coordenação de Treinamento", admissionDate: "2014-02-03", professionalLevel: "especialista", shift: "integral",
  }),
  employee({
    id: "EMP-0010", code: "0299", name: "Daniel Oliveira Prado", departmentId: "DEP-MODELAGEM", jobRoleId: "FUN-MODELISTA",
    cargo: "Modelista", admissionDate: "2020-11-09", supervisorId: "EMP-0008", professionalLevel: "avancado", shift: "integral",
  }),
  employee({
    id: "EMP-0011", code: "0305", name: "Elaine Cristina Matos", departmentId: "DEP-PREP", jobRoleId: "FUN-PREPARADOR",
    cargo: "Auxiliar de Preparação", admissionDate: "2025-04-07", supervisorId: "EMP-0008", professionalLevel: "aprendiz", shift: "manha",
  }),
];

/**
 * Usuários de demonstração. A senha de todos é "1234" — trocar no
 * primeiro uso real (painel admin → Colaboradores).
 */
export const SEED_USERS: User[] = [
  { id: "USR-0001", employeeId: "EMP-0009", login: "admin", passwordHash: hashPassword("1234"), role: "ADMIN", active: true, createdAt: "2024-01-10T12:00:00.000Z" },
  { id: "USR-0002", employeeId: "EMP-0008", login: "patricia", passwordHash: hashPassword("1234"), role: "GESTOR", active: true, createdAt: "2024-01-10T12:00:00.000Z" },
  { id: "USR-0003", employeeId: "EMP-0007", login: "sebastiao", passwordHash: hashPassword("1234"), role: "INSTRUTOR", active: true, createdAt: "2024-01-10T12:00:00.000Z" },
  { id: "USR-0004", employeeId: "EMP-0001", login: "maria", passwordHash: hashPassword("1234"), role: "COLABORADOR", active: true, createdAt: "2024-01-10T12:00:00.000Z" },
  { id: "USR-0005", employeeId: "EMP-0002", login: "joana", passwordHash: hashPassword("1234"), role: "COLABORADOR", active: true, createdAt: "2024-08-05T12:00:00.000Z" },
  { id: "USR-0006", employeeId: "EMP-0003", login: "antonio", passwordHash: hashPassword("1234"), role: "COLABORADOR", active: true, createdAt: "2024-01-10T12:00:00.000Z" },
  { id: "USR-0007", employeeId: "EMP-0005", login: "rafael", passwordHash: hashPassword("1234"), role: "INSTRUTOR", active: true, createdAt: "2024-01-10T12:00:00.000Z" },
];
