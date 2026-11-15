import nodemailer from 'nodemailer';

/**
 * E-mail through SMTP from MAIL_URL (locally Mailpit: smtp://localhost:1025). Without MAIL_URL
 * nothing is sent and the caller tells the user that verification e-mail is unavailable.
 */
export function mailConfigured(): boolean {
  return Boolean(process.env.MAIL_URL);
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const url = process.env.MAIL_URL;
  if (!url) throw new Error('MAIL_URL is not set');
  const transport = nodemailer.createTransport(url);
  await transport.sendMail({
    from: process.env.MAIL_FROM ?? 'Ember Almanac <no-reply@ember-almanac.local>',
    to,
    subject,
    text,
  });
}

const COPY = {
  en: {
    subject: 'Confirm your Ember Almanac account',
    body: (link: string) =>
      `Welcome to Ember Almanac.\n\nConfirm your e-mail address to save places and follow them:\n${link}\n\nThe link is valid for 24 hours. If you did not sign up, ignore this e-mail.`,
  },
  ru: {
    subject: 'Подтвердите аккаунт Ember Almanac',
    body: (link: string) =>
      `Добро пожаловать в Ember Almanac.\n\nПодтвердите адрес почты, чтобы сохранять места и следить за ними:\n${link}\n\nСсылка действует 24 часа. Если вы не регистрировались, просто проигнорируйте письмо.`,
  },
  tg: {
    subject: 'Ҳисоби Ember Almanac-ро тасдиқ кунед',
    body: (link: string) =>
      `Хуш омадед ба Ember Almanac.\n\nБарои нигоҳ доштани ҷойҳо ва пайгирии онҳо суроғаи почтаро тасдиқ кунед:\n${link}\n\nПайванд 24 соат эътибор дорад. Агар шумо сабти ном накарда бошед, ин мактубро нодида гиред.`,
  },
} as const;

export function verificationMail(locale: string, link: string) {
  const c = COPY[(locale in COPY ? locale : 'en') as keyof typeof COPY];
  return { subject: c.subject, text: c.body(link) };
}
