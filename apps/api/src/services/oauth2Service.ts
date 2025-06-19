import { logger } from '../utils/logger';

export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface OAuth2UserInfo {
  id: string;
  email: string;
  given_name: string;
  family_name: string;
  name: string;
  picture?: string;
}

export const oauth2Service = {
  getAuthorizationUrl(): string {
    if (!process.env.OAUTH2_CLIENT_ID || !process.env.OAUTH2_ISSUER_URL) {
      throw new Error('OAuth2 configuration missing');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.OAUTH2_CLIENT_ID,
      redirect_uri: process.env.OAUTH2_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/oauth2',
      scope: process.env.OAUTH2_SCOPE || 'openid profile email',
      state: this.generateState(),
    });

    return `${process.env.OAUTH2_ISSUER_URL}/auth?${params.toString()}`;
  },

  async exchangeCodeForToken(code: string): Promise<OAuth2TokenResponse> {
    try {
      const response = await fetch(`${process.env.OAUTH2_ISSUER_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.OAUTH2_CLIENT_ID!,
          client_secret: process.env.OAUTH2_CLIENT_SECRET!,
          code,
          redirect_uri: process.env.OAUTH2_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/oauth2',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('OAuth2 token exchange error:', error);
      throw new Error('Failed to exchange authorization code for token');
    }
  },

  async getUserInfo(accessToken: string): Promise<OAuth2UserInfo> {
    try {
      const response = await fetch(`${process.env.OAUTH2_ISSUER_URL}/userinfo`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get user info: ${error}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('OAuth2 user info error:', error);
      throw new Error('Failed to get user information');
    }
  },

  async refreshToken(refreshToken: string): Promise<OAuth2TokenResponse> {
    try {
      const response = await fetch(`${process.env.OAUTH2_ISSUER_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.OAUTH2_CLIENT_ID!,
          client_secret: process.env.OAUTH2_CLIENT_SECRET!,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('OAuth2 token refresh error:', error);
      throw new Error('Failed to refresh token');
    }
  },

  async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.OAUTH2_ISSUER_URL}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token,
          client_id: process.env.OAUTH2_CLIENT_ID!,
          client_secret: process.env.OAUTH2_CLIENT_SECRET!,
        }),
      });

      if (!response.ok) {
        logger.warn('Failed to revoke token, but continuing...');
      }
    } catch (error) {
      logger.error('OAuth2 token revocation error:', error);
      // Don't throw - token revocation failure shouldn't break logout
    }
  },

  generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  },

  validateState(state: string): boolean {
    // In a real implementation, you'd store the state in session/database
    // and validate it here. For now, just check if it exists.
    return !!state && state.length >= 16;
  },

  // Azure AD specific methods
  async getAzureADAuthorizationUrl(): Promise<string> {
    if (!process.env.AZURE_AD_CLIENT_ID || !process.env.AZURE_AD_TENANT_ID) {
      throw new Error('Azure AD configuration missing');
    }

    const params = new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID,
      response_type: 'code',
      redirect_uri: process.env.OAUTH2_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/azure',
      response_mode: 'query',
      scope: 'openid profile email',
      state: this.generateState(),
    });

    return `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
  },

  async exchangeAzureADCode(code: string): Promise<OAuth2TokenResponse> {
    try {
      const response = await fetch(`https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.AZURE_AD_CLIENT_ID!,
          client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
          scope: 'openid profile email',
          code,
          redirect_uri: process.env.OAUTH2_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/azure',
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Azure AD token exchange failed: ${error}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Azure AD token exchange error:', error);
      throw new Error('Failed to exchange Azure AD authorization code');
    }
  },

  // Google OAuth specific methods
  async getGoogleAuthorizationUrl(): Promise<string> {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error('Google OAuth configuration missing');
    }

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.OAUTH2_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/google',
      scope: 'openid profile email',
      response_type: 'code',
      state: this.generateState(),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async exchangeGoogleCode(code: string): Promise<OAuth2TokenResponse> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.OAUTH2_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/google',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google token exchange failed: ${error}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Google token exchange error:', error);
      throw new Error('Failed to exchange Google authorization code');
    }
  },
};