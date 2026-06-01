import nodemailer from 'nodemailer';

/**
 * Простой почтовый отправитель через SMTP.
 * Использует переменные окружения SMTP_HOST/PORT/USER/PASSWORD/FROM.
 * Если они не заданы — функция возвращает false без ошибки (no-op).
 */
let cached: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  cached = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: { user, pass },
  });
  return cached;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Отправляет email. Возвращает true в случае успеха, false если SMTP не настроен. */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const transport = getTransport();
  if (!transport) return false;

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  return true;
}
