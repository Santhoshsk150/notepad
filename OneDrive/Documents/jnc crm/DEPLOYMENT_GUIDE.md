# Production Deployment Guide — JSNC CRM Enterprise

## 🌐 Quick Deployment Instructions

This package contains the complete, production-ready **JSNC CRM** system (API Backend + React Single-Page Application).

---

### 📦 Package Structure

```text
jnc-crm/
├── apps/
│   ├── api/                    # NestJS Backend API (Port 3333 default)
│   │   ├── dist/               # Pre-compiled JavaScript production bundle
│   │   ├── prisma/             # Prisma Schema & Database Migrations
│   │   ├── src/                # Backend Source Code
│   │   ├── package.json
│   │   └── .env.example
│   └── web/                    # React + Vite Frontend
│       ├── dist/               # Production Static Web Build (Ready for Nginx/Apache/cPanel)
│       ├── src/                # Frontend Source Code
│       ├── package.json
│       └── vite.config.ts
├── package.json
└── README.md
```

---

## 🚀 How to Deploy on Production Server

### 1. Backend Setup (Node.js VPS / Ubuntu / Docker / Windows Server)
1. Navigate to the API folder:
   ```bash
   cd apps/api
   npm install --production
   ```
2. Configure `.env` file:
   ```env
   PORT=3333
   DATABASE_URL="postgresql://postgres:password@localhost:5432/jnc_crm?schema=public"
   JWT_SECRET="jnc-crm-super-secure-production-secret-2026"
   CORS_ORIGIN="https://your-crm-domain.com"
   ```
3. Run Database Migrations:
   ```bash
   npx prisma migrate deploy
   ```
4. Start with PM2 Process Manager:
   ```bash
   npm install -g pm2
   pm2 start dist/main.js --name "jnc-crm-api"
   pm2 save
   ```

---

### 2. Frontend Setup (Nginx / Apache / cPanel / Cloudflare / Vercel)
- Upload the contents of `apps/web/dist/` directly to your web server public HTML directory (`/var/www/html` or `public_html`).
- Configure Single Page Application URL rewrites:
  - **Nginx**:
    ```nginx
    location / {
        try_files $uri $uri/ /index.html;
    }
    ```
  - **Apache (`.htaccess`)**:
    ```apache
    <IfModule mod_rewrite.c>
      RewriteEngine On
      RewriteBase /
      RewriteRule ^index\.html$ - [L]
      RewriteCond %{REQUEST_FILENAME} !-f
      RewriteCond %{REQUEST_FILENAME} !-d
      RewriteRule . /index.html [L]
    </IfModule>
    ```

---

## 🔑 Default Super Admin Credentials
- **Name**: Jayaraj
- **Email**: `Jayarajjnc@gmail.com`
- **Role**: `super_admin`
