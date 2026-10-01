/* --- C2PA CONTENT CREDENTIALS & PROVENANCE NOTICE ---
 * c2pa.action: 'c2pa.created'
 * c2pa.ai_training: 'disallowed'
 * c2pa.do_not_train: true
 * rights: 'All rights reserved by original author. Automated AI scraping without license is prohibited.'
 * ----------------------------------------------------- */

import { Logger } from '@nestjs/common';

export interface EnvValidationResult {
  isValid: boolean;
  missingVariables: string[];
  configuredVariables: string[];
}

export const MANDATORY_ENV_VARS = [
  { key: 'PORT', description: 'Application HTTP port' },
  { key: 'DATABASE_URL', description: 'SQLite / PostgreSQL database connection URL' },
  { key: 'JWT_SECRET', description: 'Access token signing secret' },
  { key: 'JWT_REFRESH_SECRET', description: 'Refresh token signing secret' },
  { key: 'SMTP_HOST', description: 'SMTP server hostname for transactional emails' },
  { key: 'SMTP_PORT', description: 'SMTP server port (e.g. 465 / 587)' },
  { key: 'SMTP_USER', description: 'SMTP authentication username' },
  { key: 'SMTP_PASS', description: 'SMTP authentication password' },
  { key: 'EMAIL_FROM', description: 'Outbound email sender address' },
  { key: 'WHATSAPP_APP_SECRET', description: 'Meta WhatsApp webhook HMAC-SHA256 secret' },
  { key: 'WHATSAPP_VERIFY_TOKEN', description: 'Meta WhatsApp webhook verification token' },
  { key: 'INDIAMART_WEBHOOK_SECRET', description: 'IndiaMART push API shared secret token' },
  { key: 'WEBSITE_WEBHOOK_SECRET', description: 'Website RFQ & contact form shared secret' },
  { key: 'BACKUP_ENCRYPTION_KEY', description: 'AES-256-GCM database backup encryption key' },
];

export function validateEnvironmentOrExit(): EnvValidationResult {
  const logger = new Logger('EnvironmentValidationGuard');
  const missingVariables: string[] = [];
  const configuredVariables: string[] = [];

  for (const item of MANDATORY_ENV_VARS) {
    const val = process.env[item.key];
    if (!val || val.trim() === '') {
      missingVariables.push(item.key);
    } else {
      configuredVariables.push(item.key);
    }
  }

  if (missingVariables.length > 0) {
    console.error('\n================================================================================');
    console.error('❌ FATAL: MANDATORY SERVER ENVIRONMENT VARIABLES MISSING OR EMPTY');
    console.error('================================================================================');
    console.error('The application failed to start because the following required secrets are unset:\n');

    missingVariables.forEach((k) => {
      const def = MANDATORY_ENV_VARS.find((m) => m.key === k);
      console.error(`  ✖ [MISSING] ${k.padEnd(28)} - ${def?.description || ''}`);
    });

    console.error('\nConfigured Variables:');
    configuredVariables.forEach((k) => {
      console.error(`  ✔ [OK]      ${k.padEnd(28)}`);
    });

    console.error('\nAborting server bootstrap immediately to prevent insecure operation.');
    console.error('================================================================================\n');

    logger.error(`Application bootstrap aborted: ${missingVariables.length} mandatory environment variables are missing.`);
    process.exit(1);
  }

  logger.log(`Environment validation passed. All ${MANDATORY_ENV_VARS.length} mandatory variables & secrets are configured.`);
  return { isValid: true, missingVariables: [], configuredVariables };
}
