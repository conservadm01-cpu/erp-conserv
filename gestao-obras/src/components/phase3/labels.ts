export const PERSON_CATEGORY: Record<string, string> = { PROFISSIONAL: "Profissional", EMPREGADO: "Empregado", VOLUNTARIO: "Voluntário", OUTRO: "Outro vínculo" };
export const CREDENTIAL_KIND: Record<string, string> = {
  REGISTRO_CONSELHO: "Registro em conselho profissional", QUALIFICACAO: "Qualificação", HABILITACAO: "Habilitação",
  CERTIFICADO: "Certificado", TREINAMENTO: "Treinamento", INTEGRACAO_SEGURANCA: "Integração de segurança",
};
export const CONTRACT_KIND: Record<string, string> = { CONTRATO: "Contrato", ADITIVO: "Aditivo", ORDEM_SERVICO: "Ordem de serviço" };
export const CONTRACT_STATUS: Record<string, string> = { RASCUNHO: "Rascunho", VIGENTE: "Vigente", ENCERRADO: "Encerrado", CANCELADO: "Cancelado" };
export const EQUIPMENT_KIND: Record<string, string> = { FERRAMENTA: "Ferramenta", EQUIPAMENTO_COLETIVO: "Equipamento de proteção coletiva", MAQUINA: "Máquina", EPI_DURAVEL: "EPI durável (controle individual)" };
export const EQUIPMENT_STATUS: Record<string, string> = { DISPONIVEL: "Disponível", EM_USO: "Em uso", EM_MANUTENCAO: "Em manutenção", INTERDITADO: "Interditado", BAIXADO: "Baixado" };
export const RECEIPT: Record<string, string> = { TERMO_FISICO_ARQUIVADO: "Termo em papel arquivado", CONFIRMACAO_PRESENCIAL_REGISTRADA: "Confirmação presencial registrada", PENDENTE: "Pendente" };
export const INSPECTION_STATUS: Record<string, string> = { PLANEJADA: "Planejada", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluída", CANCELADA: "Cancelada" };
export const INSPECTION_RESULT: Record<string, string> = { PENDENTE: "Pendente", CONFORME: "Conforme", NAO_CONFORME: "Não conforme", NAO_APLICAVEL: "Não se aplica" };
export const ACTION_STATUS: Record<string, string> = { ABERTA: "Aberta", EM_ANDAMENTO: "Em andamento", AGUARDANDO_VALIDACAO: "Aguardando validação", ENCERRADA: "Encerrada", CANCELADA: "Cancelada" };
export const INCIDENT_TYPE: Record<string, string> = { INCIDENTE: "Incidente", QUASE_ACIDENTE: "Quase acidente", ACIDENTE: "Acidente" };
export const RISK_STATUS: Record<string, string> = { ABERTO: "Aberto", CONTROLADO: "Controlado", ENCERRADO: "Encerrado" };
export const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));
export const criticalityTone = (c: string): "slate" | "amber" | "red" | "blue" => (c === "CRITICA" ? "red" : c === "ALTA" ? "amber" : c === "MEDIA" ? "blue" : "slate");
