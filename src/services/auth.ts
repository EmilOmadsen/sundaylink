import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from './database';

export interface User {
  id: number;
  email: string;
  display_name?: string;
  spotify_user_id?: string;
  refresh_token_encrypted?: string;
  is_spotify_connected: boolean;
  auth_type: 'email' | 'spotify';
  created_at: string;
  last_polled_at?: string;
  expires_at: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

class AuthService {
  private _insertUser: any = null;
  private _getUserByEmail: any = null;
  private _getUserById: any = null;
  private _updateSpotifyConnection: any = null;

  private get insertUser() {
    if (!this._insertUser) {
      this._insertUser = db.prepare(`
        INSERT INTO users (email, password_hash, display_name, auth_type)
        VALUES (?, ?, ?, ?)
      `);
    }
    return this._insertUser;
  }

  private get getUserByEmail() {
    if (!this._getUserByEmail) {
      this._getUserByEmail = db.prepare(`
        SELECT * FROM users WHERE email = ? AND expires_at > datetime('now')
      `);
    }
    return this._getUserByEmail;
  }

  private get getUserById() {
    if (!this._getUserById) {
      this._getUserById = db.prepare(`
        SELECT * FROM users WHERE id = ? AND expires_at > datetime('now')
      `);
    }
    return this._getUserById;
  }

  private get updateSpotifyConnection() {
    if (!this._updateSpotifyConnection) {
      this._updateSpotifyConnection = db.prepare(`
        UPDATE users 
        SET spotify_user_id = ?, refresh_token_encrypted = ?, is_spotify_connected = 1
        WHERE id = ?
      `);
    }
    return this._updateSpotifyConnection;
  }

  async register(data: CreateUserData): Promise<User> {
    // Check if user already exists
    const existing = this.getUserByEmail.get(data.email) as User;
    if (existing) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    // Create user
    this.insertUser.run(
      data.email,
      passwordHash,
      data.display_name || null,
      'email'
    );

    const user = this.getUserByEmail.get(data.email) as User;
    if (!user) {
      throw new Error('Failed to create user');
    }

    return this.sanitizeUser(user);
  }

  async login(data: LoginData): Promise<{ user: User; token: string }> {
    const user = this.getUserByEmail.get(data.email) as User & { password_hash: string };
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token
    };
  }

  async connectSpotify(data: {
    user_id: number;
    spotify_id: string;
    access_token: string;
    encrypted_refresh_token: string;
    token_expires_at: Date;
  }): Promise<User> {
    this.updateSpotifyConnection.run(
      data.spotify_id, 
      data.encrypted_refresh_token, 
      data.user_id
    );

    const user = this.getUserById.get(data.user_id) as User;
    if (!user) {
      throw new Error('Failed to update Spotify connection');
    }

    return this.sanitizeUser(user);
  }

  getByEmail(email: string): User | null {
    const user = this.getUserByEmail.get(email) as User;
    return user ? this.sanitizeUser(user) : null;
  }

  getById(id: number): User | null {
    const user = this.getUserById.get(id) as User;
    return user ? this.sanitizeUser(user) : null;
  }

  generateToken(user: User): string {
    const jwtSecret = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';
    
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      },
      jwtSecret,
      { 
        expiresIn: '30d' // Token expires in 30 days
      }
    );
  }

  verifyToken(token: string): { userId: number; email: string } | null {
    try {
      const jwtSecret = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';
      const decoded = jwt.verify(token, jwtSecret) as any;
      
      return {
        userId: decoded.userId,
        email: decoded.email
      };
    } catch (error) {
      return null;
    }
  }

  private sanitizeUser(user: User & { password_hash?: string }): User {
    // Remove password hash from user object
    const { password_hash, ...sanitized } = user as any;
    return sanitized;
  }

  async deleteUserData(email: string): Promise<boolean> {
    const deleteUserStmt = db.prepare('DELETE FROM users WHERE email = ?');
    const result = deleteUserStmt.run(email);
    return result.changes > 0;
  }

  getAllForPolling(): User[] {
    const getUsersForPolling = db.prepare(`
      SELECT * FROM users 
      WHERE is_spotify_connected = 1 
      AND refresh_token_encrypted IS NOT NULL
      AND expires_at > datetime('now')
    `);
    
    const users = getUsersForPolling.all() as User[];
    return users.map(user => this.sanitizeUser(user));
  }

  updateLastPolled(userId: number): void {
    const updateLastPolledStmt = db.prepare(`
      UPDATE users SET last_polled_at = datetime('now') WHERE id = ?
    `);
    updateLastPolledStmt.run(userId);
  }

  // Express middleware to authenticate requests
  authenticate = (req: any, res: any, next: any) => {
    console.log('🔐 Authentication middleware called');
    console.log('🍪 Request cookies:', req.cookies);
    
    const token = req.cookies.auth_token;
    console.log('🎫 Auth token:', token ? 'present' : 'missing');
    
    if (!token) {
      console.log('❌ No auth token found in cookies');
      return res.status(401).json({ error: 'Authentication token required' });
    }

    const decoded = this.verifyToken(token);
    console.log('🔓 Token decoded:', decoded ? 'success' : 'failed');
    
    if (!decoded) {
      console.log('❌ Token verification failed');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get full user object
    const user = this.getById(decoded.userId);
    console.log('👤 User lookup result:', user ? `Found user ${user.email}` : 'User not found');
    
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(401).json({ error: 'User not found' });
    }

    console.log('✅ Authentication successful - setting req.user');
    req.user = user;
    next();
  };
}

export default new AuthService();