import ldap from 'ldapjs';
import { userService, User } from './userService';
import { logger } from '../utils/logger';

export interface LDAPUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  groups: string[];
}

export const ldapService = {
  async authenticate(username: string, password: string): Promise<User | null> {
    try {
      // Skip LDAP in development if not configured
      if (!process.env.LDAP_SERVER_URL || process.env.MOCK_LDAP === 'true') {
        return this.mockAuthenticate(username, password);
      }

      const client = ldap.createClient({
        url: process.env.LDAP_SERVER_URL!,
        timeout: 5000,
        connectTimeout: 10000,
      });

      // Bind with service account
      await this.bindServiceAccount(client);

      // Search for user
      const ldapUser = await this.searchUser(client, username);
      if (!ldapUser) {
        client.unbind();
        return null;
      }

      // Authenticate user
      const isAuthenticated = await this.authenticateUser(client, ldapUser.dn, password);
      if (!isAuthenticated) {
        client.unbind();
        return null;
      }

      client.unbind();

      // Get or create user in our database
      let user = await userService.getUserByEmail(ldapUser.email);
      
      if (!user) {
        user = await userService.createUser({
          email: ldapUser.email,
          firstName: ldapUser.firstName,
          lastName: ldapUser.lastName,
          provider: 'ldap',
          providerId: ldapUser.id,
          role: this.mapLDAPGroupsToRole(ldapUser.groups),
        });
      } else {
        // Update last login
        await userService.updateLastLogin(user.id);
      }

      return user;
    } catch (error) {
      logger.error('LDAP authentication error:', error);
      return null;
    }
  },

  async bindServiceAccount(client: ldap.Client): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD!, (err) => {
        if (err) {
          reject(new Error('Failed to bind with LDAP service account'));
        } else {
          resolve();
        }
      });
    });
  },

  async searchUser(client: ldap.Client, username: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const searchBase = process.env.LDAP_SEARCH_BASE!;
      const searchFilter = process.env.LDAP_SEARCH_FILTER!.replace('{{username}}', username);

      const opts = {
        filter: searchFilter,
        scope: 'sub',
        attributes: ['dn', 'mail', 'givenName', 'sn', 'memberOf', 'cn', 'uid'],
      };

      client.search(searchBase, opts, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        let user: any = null;

        res.on('searchEntry', (entry) => {
          const obj = entry.pojo;
          user = {
            dn: obj.objectName,
            id: obj.attributes.uid?.[0] || obj.attributes.cn?.[0],
            email: obj.attributes.mail?.[0],
            firstName: obj.attributes.givenName?.[0] || '',
            lastName: obj.attributes.sn?.[0] || '',
            groups: obj.attributes.memberOf || [],
          };
        });

        res.on('error', (err) => {
          reject(err);
        });

        res.on('end', () => {
          resolve(user);
        });
      });
    });
  },

  async authenticateUser(client: ldap.Client, userDN: string, password: string): Promise<boolean> {
    return new Promise((resolve) => {
      client.bind(userDN, password, (err) => {
        resolve(!err);
      });
    });
  },

  mapLDAPGroupsToRole(groups: string[]): string {
    // Map LDAP groups to application roles
    const groupMappings = {
      'CN=ProcessMaster-Admins': 'admin',
      'CN=ProcessMaster-Users': 'user',
      'CN=ProcessMaster-Viewers': 'viewer',
    };

    for (const group of groups) {
      if (groupMappings[group as keyof typeof groupMappings]) {
        return groupMappings[group as keyof typeof groupMappings];
      }
    }

    return 'user'; // Default role
  },

  async mockAuthenticate(username: string, password: string): Promise<User | null> {
    // Mock LDAP authentication for development
    logger.info('Using mock LDAP authentication');

    const mockUsers = {
      'admin': {
        email: 'admin@company.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
      },
      'user': {
        email: 'user@company.com',
        firstName: 'Regular',
        lastName: 'User',
        role: 'user',
      },
    };

    const mockUser = mockUsers[username as keyof typeof mockUsers];
    
    if (!mockUser || password !== 'password123') {
      return null;
    }

    // Get or create user in database
    let user = await userService.getUserByEmail(mockUser.email);
    
    if (!user) {
      user = await userService.createUser({
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        provider: 'ldap',
        providerId: username,
        role: mockUser.role,
      });
    } else {
      await userService.updateLastLogin(user.id);
    }

    return user;
  },

  async getUserGroups(username: string): Promise<string[]> {
    try {
      if (!process.env.LDAP_SERVER_URL || process.env.MOCK_LDAP === 'true') {
        return ['CN=ProcessMaster-Users']; // Mock groups
      }

      const client = ldap.createClient({
        url: process.env.LDAP_SERVER_URL!,
      });

      await this.bindServiceAccount(client);
      const user = await this.searchUser(client, username);
      client.unbind();

      return user?.groups || [];
    } catch (error) {
      logger.error('Failed to get user groups:', error);
      return [];
    }
  },
};