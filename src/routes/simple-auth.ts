import express from 'express';
import authService from '../services/auth';
import sessionService from '../services/sessions';

const router = express.Router();

// Simple registration page
router.get('/register', (req, res) => {
  const clickId = req.cookies.click_id;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Register - Sundaylink</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
            }
            .container {
                text-align: center;
                background: rgba(0,0,0,0.8);
                padding: 40px;
                border-radius: 12px;
                max-width: 400px;
                width: 100%;
            }
            .form-group {
                margin-bottom: 20px;
                text-align: left;
            }
            label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
            }
            input[type="email"], input[type="password"], input[type="text"] {
                width: 100%;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 16px;
                box-sizing: border-box;
            }
            .btn {
                background: #667eea;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                width: 100%;
                margin-top: 10px;
            }
            .btn:hover {
                background: #5a6fd8;
            }
            .link {
                color: #667eea;
                text-decoration: none;
                margin-top: 15px;
                display: block;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔗 Create Sundaylink Account</h1>
            
            <form action="/simple-auth/register" method="POST">
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" required>
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required minlength="6">
                </div>
                <div class="form-group">
                    <label for="display_name">Display Name (Optional)</label>
                    <input type="text" id="display_name" name="display_name">
                </div>
                <input type="hidden" name="click_id" value="${clickId || ''}">
                <button type="submit" class="btn">Create Account</button>
            </form>
            
            <a href="/simple-auth/login" class="link">Already have an account? Login here</a>
        </div>
    </body>
    </html>
  `);
});

// Simple login page
router.get('/login', (req, res) => {
  const clickId = req.cookies.click_id;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login - Sundaylink</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
            }
            .container {
                text-align: center;
                background: rgba(0,0,0,0.8);
                padding: 40px;
                border-radius: 12px;
                max-width: 400px;
                width: 100%;
            }
            .form-group {
                margin-bottom: 20px;
                text-align: left;
            }
            label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
            }
            input[type="email"], input[type="password"] {
                width: 100%;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 16px;
                box-sizing: border-box;
            }
            .btn {
                background: #667eea;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                width: 100%;
                margin-top: 10px;
            }
            .btn:hover {
                background: #5a6fd8;
            }
            .link {
                color: #667eea;
                text-decoration: none;
                margin-top: 15px;
                display: block;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔗 Login to Sundaylink</h1>
            
            <form action="/simple-auth/login" method="POST">
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" required>
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required>
                </div>
                <input type="hidden" name="click_id" value="${clickId || ''}">
                <button type="submit" class="btn">Login</button>
            </form>
            
            <a href="/simple-auth/register" class="link">Don't have an account? Sign up here</a>
            
            <div style="margin-top: 30px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 6px;">
                <strong>Test Account:</strong><br>
                Email: test@example.com<br>
                Password: test123
            </div>
        </div>
    </body>
    </html>
  `);
});

// Handle the form submissions (reuse existing logic)
router.post('/register', async (req, res) => {
  try {
    const { email, password, display_name, click_id } = req.body;

    if (!email || !password) {
      return res.status(400).send('Email and password are required');
    }

    const user = await authService.register({ email, password, display_name });
    const token = authService.generateToken(user);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    if (click_id) {
      try {
        sessionService.create({ click_id, user_id: user.id });
      } catch (error) {
        console.log('Session creation failed:', error);
      }
    }

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).send(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, click_id } = req.body;

    if (!email || !password) {
      return res.status(400).send('Email and password are required');
    }

    const { user, token } = await authService.login({ email, password });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    if (click_id) {
      try {
        sessionService.create({ click_id, user_id: user.id });
      } catch (error) {
        console.log('Session creation failed:', error);
      }
    }

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).send(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

export default router;