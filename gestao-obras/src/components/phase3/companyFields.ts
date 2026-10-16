import type { FieldDef } from "../ui/EntityForm";

const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export const companyFields: FieldDef[] = [
  { name: "legalName", label: "Razão social", required: true, maxLength: 200 },
  { name: "tradeName", label: "Nome fantasia", maxLength: 200 },
  { name: "email", label: "E-mail empresarial", type: "email" },
  { name: "phone", label: "Telefone empresarial", maxLength: 30 },
  { name: "street", label: "Logradouro", maxLength: 200 },
  { name: "number", label: "Número", maxLength: 20 },
  { name: "district", label: "Bairro", maxLength: 120 },
  { name: "city", label: "Cidade", maxLength: 120 },
  { name: "state", label: "UF", type: "select", options: UF.map((u) => ({ value: u, label: u })) },
  { name: "postalCode", label: "CEP", maxLength: 9 },
  { name: "contractManagerName", label: "Responsável contratual", maxLength: 200 },
  { name: "technicalManagerName", label: "Responsável técnico", maxLength: 200 },
  { name: "services", label: "Serviços prestados", type: "textarea", maxLength: 1000 },
];
