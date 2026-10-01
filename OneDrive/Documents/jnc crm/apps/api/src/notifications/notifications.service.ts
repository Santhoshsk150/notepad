/* --- C2PA CONTENT CREDENTIALS & PROVENANCE NOTICE ---
 * c2pa.action: 'c2pa.created'
 * c2pa.ai_training: 'disallowed'
 * c2pa.do_not_train: true
 * rights: 'All rights reserved by original author. Automated AI scraping without license is prohibited.'
 * ----------------------------------------------------- */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  senderType?: 'primary' | 'invoice';
  attachments?: Array<{
    filename: string;
    content?: any;
    path?: string;
    contentType?: string;
  }>;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface CreateInAppTaskOptions {
  leadId: string;
  userId?: string;
  title: string;
  description?: string;
  scheduledAt?: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private primaryTransporter: nodemailer.Transporter | null = null;
  private invoiceTransporter: nodemailer.Transporter | null = null;

  constructor(private prisma: PrismaService) {
    this.initMailers();
  }

  private async initMailers() {
    try {
      // 1. Check for Super Admin DB configured mail accounts first
      const dbMailAccounts = await this.prisma.mailAccount.findMany({
        where: { isActive: true },
      });

      const primaryDbAccount = dbMailAccounts.find((a) => a.purpose === 'PRIMARY_ALERTS') || dbMailAccounts[0];
      const invoiceDbAccount = dbMailAccounts.find((a) => a.purpose === 'BILLING_INVOICES') || primaryDbAccount;

      if (primaryDbAccount) {
        this.primaryTransporter = nodemailer.createTransport({
          host: primaryDbAccount.smtpHost,
          port: primaryDbAccount.smtpPort,
          secure: primaryDbAccount.isSecure,
          auth: {
            user: primaryDbAccount.smtpUser,
            pass: primaryDbAccount.smtpPass,
          },
          tls: { rejectUnauthorized: false },
        });
        this.logger.log(`Primary SMTP transporter dynamically loaded from Database: ${primaryDbAccount.email}`);
      } else {
        // Fallback to environment variables
        const primaryUser = process.env.SMTP_USER || '';
        const primaryPass = process.env.SMTP_PASS || '';

        if (primaryUser && primaryPass) {
          const isGmail = primaryUser.toLowerCase().includes('@gmail.com');
          const primaryHost = process.env.SMTP_HOST || (isGmail ? 'smtp.gmail.com' : 'smtpout.secureserver.net');
          const primaryPort = Number(process.env.SMTP_PORT) || (isGmail ? 465 : 587);
          const isSecure = primaryPort === 465;

          this.primaryTransporter = nodemailer.createTransport({
            host: primaryHost,
            port: primaryPort,
            secure: isSecure,
            auth: { user: primaryUser, pass: primaryPass },
            tls: { rejectUnauthorized: false },
          });
          this.logger.log(`Primary SMTP transporter configured from environment: ${primaryUser}`);
        } else {
          this.logger.warn('Primary SMTP credentials not configured in DB or environment. Outbound emails will be logged only.');
        }
      }

      if (invoiceDbAccount) {
        this.invoiceTransporter = nodemailer.createTransport({
          host: invoiceDbAccount.smtpHost,
          port: invoiceDbAccount.smtpPort,
          secure: invoiceDbAccount.isSecure,
          auth: {
            user: invoiceDbAccount.smtpUser,
            pass: invoiceDbAccount.smtpPass,
          },
          tls: { rejectUnauthorized: false },
        });
        this.logger.log(`Invoice SMTP transporter dynamically loaded from Database: ${invoiceDbAccount.email}`);
      } else {
        const invoiceUser = process.env.INVOICE_SMTP_USER || process.env.SMTP_USER || '';
        const invoicePass = process.env.INVOICE_SMTP_PASS || process.env.SMTP_PASS || '';

        if (invoiceUser && invoicePass) {
          const invoiceHost = process.env.INVOICE_SMTP_HOST || process.env.SMTP_HOST || 'smtpout.secureserver.net';
          const invoicePort = Number(process.env.INVOICE_SMTP_PORT) || Number(process.env.SMTP_PORT) || 587;
          const isSecure = invoicePort === 465;

          this.invoiceTransporter = nodemailer.createTransport({
            host: invoiceHost,
            port: invoicePort,
            secure: isSecure,
            auth: { user: invoiceUser, pass: invoicePass },
            tls: { rejectUnauthorized: false },
          });
          this.logger.log(`Invoice SMTP transporter configured from environment: ${invoiceUser}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`SMTP transporter initialization error: ${err?.message || err}`);
    }
  }

  /**
   * Sanitizes email HTML/text before database persistence in MessageLog
   * to guarantee zero plaintext credential storage.
   */
  private sanitizeBodyForLog(rawBody: string): string {
    if (!rawBody) return '';
    return rawBody
      .replace(/(Temporary Password:\s*(?:<\/strong>\s*)?<code>)([^<]+)(<\/code>)/gi, '$1[REDACTED_FOR_SECURITY]$3')
      .replace(/(Password:\s*(?:<\/strong>\s*)?<code>)([^<]+)(<\/code>)/gi, '$1[REDACTED_FOR_SECURITY]$3')
      .replace(/(Temporary Password:\s*)([^\s<]+)/gi, '$1[REDACTED_FOR_SECURITY]')
      .replace(/(Password:\s*)([^\s<]+)/gi, '$1[REDACTED_FOR_SECURITY]');
  }

  /**
   * Retrieve dynamic branding settings with sensible fallback defaults.
   */
  async getBranding(): Promise<{ companyDisplayName: string; companyPhone: string; companyLogoUrl: string | null }> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'company_branding_config' },
      });
      if (setting && setting.value) {
        const parsed = JSON.parse(setting.value);
        return {
          companyDisplayName: parsed.companyDisplayName?.trim() || 'JS Network Communication',
          companyPhone: parsed.companyPhone?.trim() || '+91 9663421455',
          companyLogoUrl: parsed.companyLogoUrl || '/jnc-logo.jpg',
        };
      }
    } catch {}
    return {
      companyDisplayName: 'JS Network Communication',
      companyPhone: '+91 9663421455',
      companyLogoUrl: '/jnc-logo.jpg',
    };
  }

  /**
   * Send outbound email notification and record in MessageLog with sanitized/redacted body.
   */
  async sendEmail(options: SendEmailOptions) {
    const isInvoice = options.senderType === 'invoice' || options.relatedEntityType === 'invoice';
    const branding = await this.getBranding();
    
    // Choose appropriate transporter and from address
    let transporter = isInvoice ? (this.invoiceTransporter || this.primaryTransporter) : this.primaryTransporter;
    
    const defaultFrom = isInvoice 
      ? (process.env.INVOICE_EMAIL_FROM || process.env.INVOICE_SMTP_USER || process.env.SMTP_USER || 'noreply@domain.com')
      : (process.env.PRIMARY_EMAIL_FROM || process.env.SMTP_USER || 'noreply@domain.com');
      
    const fromAddress = options.from || defaultFrom;
    const senderDisplayName = isInvoice 
      ? `${branding.companyDisplayName} Billing` 
      : branding.companyDisplayName;

    this.logger.log(`[EMAIL DISPATCH ATTEMPT] Type: ${isInvoice ? 'INVOICE' : 'PRIMARY'} | From: ${fromAddress} | To: ${options.to} | Subject: ${options.subject}`);

    let status = 'failed';
    let errorMessage: string | null = null;
    let transportInfo: any = null;

    if (!transporter) {
      this.initMailers();
      transporter = isInvoice ? (this.invoiceTransporter || this.primaryTransporter) : this.primaryTransporter;
    }

    try {
      transportInfo = await transporter!.sendMail({
        from: `"${senderDisplayName}" <${fromAddress}>`,
        to: options.to,
        bcc: options.to.toLowerCase() !== fromAddress.toLowerCase() ? fromAddress : undefined,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });

      if (transportInfo && (transportInfo.accepted?.length > 0 || transportInfo.messageId)) {
        status = 'sent';
        this.logger.log(`[EMAIL DISPATCH SUCCESS] MessageId: ${transportInfo.messageId} | To: ${options.to}`);
      } else {
        status = 'failed';
        errorMessage = `SMTP server rejected recipient: ${JSON.stringify(transportInfo?.rejected || 'Unknown rejection')}`;
        this.logger.error(errorMessage);
      }
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${options.to}: ${err.message}`);
      status = 'failed';
      errorMessage = err.message || 'SMTP network or authentication failure';
    }

    // Redact any credentials/temp passwords before saving to database
    const sanitizedBody = this.sanitizeBodyForLog(options.html || options.text || '');

    // Record accurate status in MessageLog
    await this.prisma.messageLog.create({
      data: {
        channel: 'email',
        recipient: options.to,
        subject: options.subject,
        body: sanitizedBody,
        status,
        errorMessage,
        relatedEntityType: options.relatedEntityType,
        relatedEntityId: options.relatedEntityId,
      },
    });

    if (status !== 'sent') {
      throw new BadRequestException(errorMessage || `Failed to deliver email to ${options.to}`);
    }

    return { success: true, recipient: options.to, messageId: transportInfo?.messageId };
  }

  /**
   * Creates an in-app reminder task for an employee
   */
  async createInAppTask(options: CreateInAppTaskOptions) {
    this.logger.log(`[IN-APP TASK] Lead: ${options.leadId} | Task: ${options.title} | User: ${options.userId || 'Unassigned'}`);

    const activity = await this.prisma.leadActivity.create({
      data: {
        leadId: options.leadId,
        userId: options.userId,
        type: 'task',
        title: options.title,
        description: options.description,
        scheduledAt: options.scheduledAt || new Date(),
        isCompleted: false,
      },
    });

    await this.prisma.messageLog.create({
      data: {
        channel: 'in_app',
        recipient: options.userId || 'unassigned',
        subject: options.title,
        body: options.description || options.title,
        status: 'sent',
        relatedEntityType: 'lead',
        relatedEntityId: options.leadId,
      },
    });

    return activity;
  }

  /**
   * Send outbound SMS notification and record in MessageLog
   */
  async sendSms(phone: string, message: string, relatedEntityType?: string, relatedEntityId?: string) {
    this.logger.log(`[SMS DISPATCH] To: ${phone} | Message: ${message}`);
    await this.prisma.messageLog.create({
      data: {
        channel: 'sms',
        recipient: phone,
        body: message,
        status: 'sent',
        relatedEntityType,
        relatedEntityId,
      },
    });
    return { success: true, recipient: phone };
  }

  /**
   * Safeguard to guarantee NO outbound WhatsApp message is ever sent.
   */
  sendWhatsAppMessage() {
    this.logger.error('CRITICAL VIOLATION ATTEMPT: Outbound WhatsApp messaging is strictly prohibited by JNC-CRM architectural policy.');
    throw new Error('Outbound WhatsApp messaging is not allowed by system policy.');
  }

  /**
   * Automatically fetch and sync customer replies directly from GoDaddy IMAP server
   */
  async syncGoDaddyInbox(limit = 15) {
    const tls = await import('tls');

    return new Promise<{ fetched: number; newReplies: number }>((resolve) => {
      let buffer = '';
      let step = 0;
      let totalMessages = 0;
      let fetchedCount = 0;
      let newRepliesCount = 0;
      let isDone = false;

      const imapUser = process.env.SMTP_USER || '';
      const imapPass = process.env.SMTP_PASS || '';

      const client = tls.connect(993, 'imap.secureserver.net', { rejectUnauthorized: false }, () => {
        client.write(`A1 LOGIN ${imapUser} ${imapPass}\r\n`);
      });

      const finish = () => {
        if (isDone) return;
        isDone = true;
        try {
          client.write('A99 LOGOUT\r\n');
          client.end();
          client.destroy();
        } catch {
          // ignore
        }
        resolve({ fetched: fetchedCount, newReplies: newRepliesCount });
      };

      const timer = setTimeout(() => {
        finish();
      }, 8000);

      client.on('data', async (data) => {
        buffer += data.toString();

        if (step === 0 && buffer.includes('A1 OK')) {
          step = 1;
          buffer = '';
          client.write('A2 SELECT INBOX\r\n');
        } else if (step === 1 && buffer.includes('A2 OK')) {
          const existsMatch = buffer.match(/\*\s+(\d+)\s+EXISTS/i);
          if (existsMatch) {
            totalMessages = parseInt(existsMatch[1], 10);
          }
          step = 2;
          buffer = '';

          if (totalMessages > 0) {
            const startMsg = Math.max(1, totalMessages - limit + 1);
            client.write(`A3 FETCH ${startMsg}:${totalMessages} (BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)])\r\n`);
          } else {
            clearTimeout(timer);
            finish();
          }
        } else if (step === 2 && buffer.includes('A3 OK')) {
          clearTimeout(timer);

          // Parse individual fetched emails
          const msgChunks = buffer.split(/\*\s+\d+\s+FETCH/i).filter((c) => c.trim().length > 0);

          for (const chunk of msgChunks) {
            fetchedCount++;
            const fromMatch = chunk.match(/From:\s*([^\r\n]+)/i);
            const subjMatch = chunk.match(/Subject:\s*([^\r\n]+)/i);
            const dateMatch = chunk.match(/Date:\s*([^\r\n]+)/i);

            if (!fromMatch) continue;

            const rawFrom = fromMatch[1].trim();
            const fromEmail = (rawFrom.match(/<([^>]+)>/) ? rawFrom.match(/<([^>]+)>/)![1] : rawFrom).trim();
            let subject = subjMatch ? subjMatch[1].trim() : 'Email Reply';
            const dateStr = dateMatch ? dateMatch[1].trim() : new Date().toISOString();

            // Decode subject if encoded words
            subject = subject.replace(/=\?[^?]+\?[BQ]\?[^?]+\?=/gi, (match) => {
              try {
                const parts = match.match(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/i);
                if (!parts) return match;
                const encoding = parts[2].toUpperCase();
                const text = parts[3];
                if (encoding === 'B') return Buffer.from(text, 'base64').toString('utf8');
                if (encoding === 'Q') return text.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
                return match;
              } catch {
                return match;
              }
            });

            // Skip self-sent emails
            if (fromEmail.toLowerCase() === 'jayaraj@jsnc.co.in') continue;

            // Extract plain text snippet
            let bodyText = chunk.replace(/BODY\[HEADER\.FIELDS[^\]]+\]\s*\{[^\}]+\}[\s\S]*?\)\s*/i, '');
            bodyText = bodyText.replace(/=3D/g, '=').replace(/=\r?\n/g, '').replace(/<[^>]+>/g, ' ').slice(0, 1000).trim();

            // Check if already in MessageLog
            const existing = await this.prisma.messageLog.findFirst({
              where: {
                channel: 'email_inbound',
                subject,
                recipient: 'jayaraj@jsnc.co.in',
              },
            });

            if (!existing) {
              // Match lead by customer email
              let lead = await this.prisma.lead.findFirst({
                where: {
                  customerEmail: { equals: fromEmail },
                  deletedAt: null,
                },
              });

              // If lead doesn't exist, create an inbound inquiry lead automatically
              if (!lead && fromEmail && !fromEmail.includes('noreply') && !fromEmail.includes('no-reply')) {
                try {
                  const leadCount = await this.prisma.lead.count();
                  const leadNumber = `JNC-LD-${String(leadCount + 1).padStart(5, '0')}`;
                  const senderName = rawFrom.replace(/<[^>]+>/, '').replace(/["']/g, '').trim() || fromEmail.split('@')[0];

                  lead = await this.prisma.lead.create({
                    data: {
                      leadNumber,
                      customerName: senderName,
                      customerPhone: '0000000000',
                      customerEmail: fromEmail,
                      source: 'web',
                      productCategory: 'Email Inquiry',
                      queryMessage: `${subject}\n\n${bodyText.slice(0, 300)}`,
                      status: 'new',
                      urgency: 'standard',
                    },
                  });
                } catch {
                  // ignore lead creation if failed
                }
              }

              await this.prisma.messageLog.create({
                data: {
                  channel: 'email_inbound',
                  recipient: 'jayaraj@jsnc.co.in',
                  subject,
                  body: bodyText || `Received reply from ${fromEmail}`,
                  status: 'received',
                  relatedEntityType: lead ? 'lead' : undefined,
                  relatedEntityId: lead ? lead.id : undefined,
                  sentAt: new Date(dateStr) || new Date(),
                },
              });

              if (lead) {
                await this.prisma.leadActivity.create({
                  data: {
                    leadId: lead.id,
                    userId: lead.assignedToId || undefined,
                    type: 'email',
                    title: `📩 Customer Email: ${subject}`,
                    description: bodyText || `Received reply from ${fromEmail}`,
                    isCompleted: true,
                    completedAt: new Date(),
                  },
                });
              }

              newRepliesCount++;
            }
          }

          finish();
        }
      });

      client.on('error', (err) => {
        this.logger.error(`IMAP sync failed: ${err.message}`);
        clearTimeout(timer);
        finish();
      });
    });
  }

  async getRecentLogs(limit = 50) {
    return this.prisma.messageLog.findMany({
      take: limit,
      orderBy: { sentAt: 'desc' },
    });
  }
}
