import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aviso de privacidade" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 leading-relaxed [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3">
      <Link href="/" className="text-sm text-accent hover:underline">← Voltar</Link>
      <h1 className="mt-4 font-display text-4xl font-bold">Aviso de privacidade</h1>
      <p className="text-sm text-muted">Versão 0.1 — modelo para o MVP. Revise com assessoria jurídica antes de publicar e preencha os dados do controlador.</p>

      <h2>1. Quem trata seus dados</h2>
      <p>O controlador é o responsável pela publicação do VIAJAR+ (preencher razão social, CNPJ e contato do encarregado/DPO). Para exercer direitos, escreva para o contato indicado.</p>

      <h2>2. Dados que coletamos</h2>
      <ul>
        <li>Conta: nome, e-mail e senha (a senha é guardada apenas como hash pelo provedor de autenticação).</li>
        <li>Viagens: destinos, datas, participantes (nomes e idades de crianças), preferências, restrições e necessidades de acessibilidade informadas por você.</li>
        <li>Finanças da viagem: orçamento, cotações, despesas e pagamentos. Não guardamos números de cartão, CVV nem senhas de fornecedores.</li>
        <li>Conteúdo: diário, fotos, vídeos, áudios, documentos e vouchers enviados.</li>
        <li>Localização: somente se você autorizar, a localização GPS contida nas fotos. Por padrão ela é descartada.</li>
        <li>Dados técnicos mínimos para segurança (ex.: IP para limitar requisições abusivas), sem rastreamento publicitário.</li>
      </ul>

      <h2>3. Finalidades e bases legais</h2>
      <ul>
        <li>Executar o serviço que você pediu (planejamento, orçamento, diário e álbum) — execução de contrato.</li>
        <li>Segurança, prevenção a fraudes e abusos — legítimo interesse.</li>
        <li>Localização em fotos e compartilhamento com participantes — consentimento, revogável em Configurações.</li>
      </ul>

      <h2>4. Compartilhamento</h2>
      <p>Seus dados não são vendidos. Fotos e localização nunca são públicas: só membros aceitos de uma viagem, com a permissão correspondente, podem acessá-las. Operadores envolvidos: Supabase (banco de dados, autenticação e armazenamento) e a hospedagem da aplicação. Nas pesquisas, enviamos aos provedores (ex.: OpenStreetMap, Open-Meteo, serviços de câmbio e, se configurados, Amadeus/Duffel) apenas os parâmetros da busca — destino, datas e número de viajantes — sem nome ou e-mail.</p>

      <h2>5. Retenção</h2>
      <p>Os dados ficam guardados enquanto a conta existir ou até você excluí-los. Ao excluir a conta, apagamos viagens das quais você é dono e os arquivos correspondentes; cópias de segurança do provedor expiram conforme a política dele.</p>

      <h2>6. Seus direitos (LGPD, art. 18)</h2>
      <p>Confirmação e acesso, correção, portabilidade, eliminação, informação sobre compartilhamento e revogação do consentimento. Em <Link href="/configuracoes" className="underline">Configurações</Link> você exporta todos os seus dados em JSON e exclui sua conta.</p>

      <h2>7. Modo demonstração local</h2>
      <p>Sem o Supabase configurado, o VIAJAR+ guarda tudo apenas no seu navegador (IndexedDB). Nada é enviado a servidores, exceto consultas de pesquisa às APIs públicas.</p>

      <h2>8. Segurança</h2>
      <p>Conexões criptografadas, controle de acesso por linha no banco (RLS), arquivos privados com links temporários, validação do conteúdo real dos arquivos enviados e logs sem dados secretos.</p>
    </article>
  );
}
