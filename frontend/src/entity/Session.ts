export interface Session {
  authenticated: boolean;
  csrfToken: string;
  authAvailable: boolean;
  demoAvailable: boolean;
  demo: boolean;
  expiresAt: string | null;
}
