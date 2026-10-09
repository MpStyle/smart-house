import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    {
      command: 'dotnet build backend/SmartHouse.Api --nologo --verbosity quiet && cd backend/SmartHouse.Api && dotnet bin/Debug/net10.0/SmartHouse.Api.dll --urls http://localhost:5080',
      cwd: '..',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development', DemoMode: 'true', PublicOrigin: 'http://localhost:5173',
        Netatmo__ClientId: '', Netatmo__ClientSecret: '',
      },
      url: 'http://localhost:5080/api/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  ],
});
