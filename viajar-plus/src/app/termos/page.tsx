import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 leading-relaxed [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3">
      <Link href="/" className="text-sm text-accent hover:underline">← Voltar</Link>
      <h1 className="mt-4 font-display text-4xl font-bold">Termos de uso</h1>
      <p className="text-sm text-muted">Versão 0.1 — modelo para o MVP. Revise com assessoria jurídica antes de publicar.</p>

      <h2>1. O que o VIAJAR+ faz</h2>
      <p>É uma ferramenta de planejamento: organiza pesquisas, cotações, orçamento, roteiro, reservas informadas por você, diário e álbuns. O VIAJAR+ <strong>não vende passagens, hospedagens, locações ou passeios e não conclui compras</strong>. Os links levam ao site do fornecedor, onde a compra acontece sob as regras dele.</p>

      <h2>2. Preços e disponibilidade de terceiros</h2>
      <ul>
        <li>Preços, tarifas, taxas e disponibilidade vêm de fornecedores ou foram registrados manualmente por você, e podem mudar a qualquer momento.</li>
        <li>Cada cotação mostra fonte, data e hora da consulta. Cotações antigas são marcadas para nova consulta.</li>
        <li>A cobertura das pesquisas é parcial: não garantimos ter encontrado o menor preço do mercado nem prevemos preços futuros.</li>
        <li>Valores de demonstração são fictícios e identificados como tal.</li>
        <li>Câmbio exibido é de referência; o valor cobrado pelo seu banco ou cartão pode ser diferente.</li>
      </ul>

      <h2>3. Sua responsabilidade</h2>
      <ul>
        <li>Confirmar com o fornecedor horários, regras tarifárias, idade mínima, documentos e políticas de cancelamento.</li>
        <li>Enviar apenas conteúdo que você tem direito de usar. Não use músicas ou imagens protegidas sem licença nos vídeos e álbuns.</li>
        <li>Obter autorização das pessoas que aparecem em fotos e vídeos antes de compartilhá-los.</li>
        <li>Não enviar dados de cartões, senhas ou arquivos maliciosos.</li>
      </ul>

      <h2>4. Participantes e permissões</h2>
      <p>O dono da viagem decide quem participa e com quais permissões (orçamento, reservas, diário, mídia). Participantes veem apenas o que a permissão concede.</p>

      <h2>5. Disponibilidade do serviço</h2>
      <p>Integrações externas podem ficar indisponíveis ou ter limites de uso. Quando uma fonte não responde, o VIAJAR+ informa a indisponibilidade em vez de exibir resultados inventados.</p>

      <h2>6. Privacidade</h2>
      <p>O tratamento de dados segue o <Link href="/privacidade" className="underline">aviso de privacidade</Link>.</p>
    </article>
  );
}
