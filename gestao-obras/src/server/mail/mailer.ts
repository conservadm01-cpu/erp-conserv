import nodemailer from "nodemailer";
import { env } from "../env";

export type MailMessage = { to: string; subject: string; text: string };

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Desenvolvimento: escreve a mensagem no console do servidor. */
class ConsoleMailer implements Mailer {
  async send(m: MailMessage) {
    console.info(`\n[e-mail] Para: ${m.to}\n[e-mail] Assunto: ${m.subject}\n${m.text}\n`);
  }
}

/** Testes: guarda as mensagens em memória. */
export class MemoryMailer implements Mailer {
  readonly outbox: MailMessage[] = [];
  async send(m: MailMessage) {
    this.outbox.push(m);
  }
}

class SmtpMailer implements Mailer {
  private transport = nodemailer.createTransport({
    host: env().SMTP_HOST,
    port: env().SMTP_PORT ?? 587,
    secure: env().SMTP_SECURE,
    auth: env().SMTP_USER ? { user: env().SMTP_USER, pass: env().SMTP_PASSWORD } : undefined,
  });
  async send(m: MailMessage) {
    await this.transport.sendMail({ from: env().MAIL_FROM, to: m.to, subject: m.subject, text: m.text });
  }
}

let instance: Mailer | undefined;

export function getMailer(): Mailer {
  if (instance) return instance;
  const driver = env().MAIL_DRIVER;
  instance = driver === "smtp" ? new SmtpMailer() : driver === "memory" ? new MemoryMailer() : new ConsoleMailer();
  return instance;
}

/** Permite substituir o adaptador (testes). */
export function setMailer(m: Mailer) {
  instance = m;
}
