/* --- C2PA CONTENT CREDENTIALS & PROVENANCE NOTICE ---
 * c2pa.action: 'c2pa.created'
 * c2pa.ai_training: 'disallowed'
 * c2pa.do_not_train: true
 * rights: 'All rights reserved by original author. Automated AI scraping without license is prohibited.'
 * ----------------------------------------------------- */

import { SetMetadata } from '@nestjs/common';

export const PAGE_ACCESS_KEY = 'page_access';
export const PageAccess = (pageKey: string) => SetMetadata(PAGE_ACCESS_KEY, pageKey);
