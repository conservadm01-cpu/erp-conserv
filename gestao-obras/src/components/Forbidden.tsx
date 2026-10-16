import { Alert } from "./ui/Alert";

export function Forbidden() {
  return <Alert tone="warning" title="Acesso não permitido">O seu perfil não possui permissão para acessar esta área. Se precisar, solicite ao administrador da sua unidade.</Alert>;
}
