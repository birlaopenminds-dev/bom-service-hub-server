import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealthStatus() {
    return {
      status: 'UP',
      service: 'BOM ServiceHub IT Helpdesk Backend API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  getLandingHtml(): string {
    const env = process.env.NODE_ENV || 'development';
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BOM ServiceHub - API Engine</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      min-height: 100vh;
      background-color: #0b0f19 !important;
      color: #f8fafc !important;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      background-image: 
        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.25) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.25) 0px, transparent 50%),
        radial-gradient(at 50% 50%, rgba(6, 182, 212, 0.12) 0px, transparent 50%) !important;
      background-attachment: fixed;
    }
    .container {
      max-width: 920px;
      width: 100%;
    }
    .card-main {
      background: rgba(22, 31, 48, 0.85) !important;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 24px;
      padding: 3rem 2.5rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.5rem 1.25rem;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.15) !important;
      border: 1px solid rgba(16, 185, 129, 0.4) !important;
      color: #10b981 !important;
      font-size: 0.9rem;
      font-weight: 600;
      letter-spacing: 0.025em;
      margin-bottom: 1.25rem;
    }
    .pulse-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: #10b981 !important;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .title {
      font-size: 2.5rem;
      font-weight: 800;
      color: #ffffff !important;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
    }
    .subtitle {
      color: #94a3b8 !important;
      font-size: 1.1rem;
      max-width: 620px;
      line-height: 1.6;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }
    .btn-card {
      background: rgba(30, 41, 59, 0.7) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      border-radius: 16px;
      padding: 1.5rem;
      text-decoration: none !important;
      color: #f8fafc !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .btn-card:hover {
      transform: translateY(-4px);
      background: rgba(45, 61, 88, 0.9) !important;
      border-color: rgba(99, 102, 241, 0.5) !important;
      box-shadow: 0 12px 24px -8px rgba(99, 102, 241, 0.4);
    }
    .btn-card.highlight {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.25) 100%) !important;
      border-color: rgba(99, 102, 241, 0.45) !important;
    }
    .card-icon {
      font-size: 1.85rem;
      margin-bottom: 0.75rem;
    }
    .card-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #ffffff !important;
      margin-bottom: 0.35rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .card-desc {
      font-size: 0.875rem;
      color: #94a3b8 !important;
      line-height: 1.45;
    }
    .arrow {
      margin-left: auto;
      transition: transform 0.2s;
      color: #6366f1 !important;
    }
    .btn-card:hover .arrow {
      transform: translateX(5px);
      color: #8b5cf6 !important;
    }
    .info-box {
      background: rgba(15, 23, 42, 0.75) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      border-radius: 16px;
      padding: 1.5rem;
    }
    .info-header {
      font-size: 0.85rem;
      font-weight: 700;
      color: #94a3b8 !important;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 1rem;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1.25rem;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 0.75rem;
      color: #94a3b8 !important;
    }
    .info-value {
      font-size: 0.95rem;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace, monospace;
      color: #38bdf8 !important;
      margin-top: 0.25rem;
    }
    .footer {
      text-align: center;
      margin-top: 2rem;
      font-size: 0.85rem;
      color: #64748b !important;
    }
  </style>
</head>
<body style="background-color: #0b0f19; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; margin: 0; padding: 2rem 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center;">
  <div class="container" style="max-width: 920px; width: 100%;">
    <div class="card-main" style="background-color: rgba(22, 31, 48, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 3rem 2.5rem;">
      <div class="header" style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 2.5rem;">
        <div class="status-badge" style="display: inline-flex; align-items: center; gap: 0.6rem; padding: 0.5rem 1.25rem; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #10b981; font-size: 0.9rem; font-weight: 600; margin-bottom: 1.25rem;">
          <span class="pulse-dot" style="width: 10px; height: 10px; border-radius: 50%; background-color: #10b981; display: inline-block;"></span>
          <span>BOM ServiceHub API Service is Running</span>
        </div>
        <h1 class="title" style="font-size: 2.5rem; font-weight: 800; color: #ffffff; margin-bottom: 0.75rem;">BOM ServiceHub API Engine</h1>
        <p class="subtitle" style="color: #94a3b8; font-size: 1.1rem; max-width: 620px; line-height: 1.6;">Production-Grade Enterprise IT Helpdesk & Ticketing System Backend API</p>
      </div>

      <div class="grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem;">
        <a href="/api/docs" class="btn-card highlight" style="background-color: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.45); border-radius: 16px; padding: 1.5rem; text-decoration: none; color: #f8fafc; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div class="card-icon" style="font-size: 1.85rem; margin-bottom: 0.75rem;">📚</div>
            <div class="card-title" style="font-size: 1.1rem; font-weight: 700; color: #ffffff; margin-bottom: 0.35rem; display: flex; align-items: center; justify-content: space-between;">
              <span>Swagger OpenAPI Docs</span>
              <span class="arrow" style="color: #6366f1;">➔</span>
            </div>
            <div class="card-desc" style="font-size: 0.875rem; color: #94a3b8; line-height: 1.45;">Interactive Swagger API documentation & testing interface.</div>
          </div>
        </a>

        <a href="/api/v1/health" class="btn-card" style="background-color: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 1.5rem; text-decoration: none; color: #f8fafc; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div class="card-icon" style="font-size: 1.85rem; margin-bottom: 0.75rem;">🩺</div>
            <div class="card-title" style="font-size: 1.1rem; font-weight: 700; color: #ffffff; margin-bottom: 0.35rem; display: flex; align-items: center; justify-content: space-between;">
              <span>Health Check API</span>
              <span class="arrow" style="color: #6366f1;">➔</span>
            </div>
            <div class="card-desc" style="font-size: 0.875rem; color: #94a3b8; line-height: 1.45;">Check live service status, version, and server timestamp.</div>
          </div>
        </a>
      </div>

      <div class="info-box" style="background-color: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 1.5rem;">
        <div class="info-header" style="font-size: 0.85rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1rem;">System Status & Environment</div>
        <div class="info-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1.25rem;">
          <div class="info-item" style="display: flex; flex-direction: column;">
            <span class="info-label" style="font-size: 0.75rem; color: #94a3b8;">Environment</span>
            <span class="info-value" style="font-size: 0.95rem; font-weight: 600; color: #38bdf8; margin-top: 0.25rem; font-family: monospace;">${env}</span>
          </div>
          <div class="info-item" style="display: flex; flex-direction: column;">
            <span class="info-label" style="font-size: 0.75rem; color: #94a3b8;">API Version</span>
            <span class="info-value" style="font-size: 0.95rem; font-weight: 600; color: #38bdf8; margin-top: 0.25rem; font-family: monospace;">v1.0.0</span>
          </div>
          <div class="info-item" style="display: flex; flex-direction: column;">
            <span class="info-label" style="font-size: 0.75rem; color: #94a3b8;">Engine Framework</span>
            <span class="info-value" style="font-size: 0.95rem; font-weight: 600; color: #38bdf8; margin-top: 0.25rem; font-family: monospace;">NestJS 10 (Express)</span>
          </div>
          <div class="info-item" style="display: flex; flex-direction: column;">
            <span class="info-label" style="font-size: 0.75rem; color: #94a3b8;">Database ORM</span>
            <span class="info-value" style="font-size: 0.95rem; font-weight: 600; color: #38bdf8; margin-top: 0.25rem; font-family: monospace;">Prisma + PostgreSQL</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer" style="text-align: center; margin-top: 2rem; font-size: 0.85rem; color: #64748b;">
      &copy; ${year} BOM ServiceHub Engine • Enterprise IT Service Management
    </div>
  </div>
</body>
</html>`;
  }
}

