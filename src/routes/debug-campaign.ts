import express from 'express';

const router = express.Router();

// Simple debug page to test campaign creation
router.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Debug Campaign Creation</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .debug { background: #f0f0f0; padding: 20px; margin: 10px 0; border-radius: 5px; }
            .success { background: #d4edda; color: #155724; }
            .error { background: #f8d7da; color: #721c24; }
            button { padding: 10px 20px; margin: 5px; font-size: 16px; }
            input { padding: 10px; margin: 5px; width: 300px; }
        </style>
    </head>
    <body>
        <h1>🔧 Debug Campaign Creation</h1>
        
        <div class="debug">
            <h3>Step 1: Test API_BASE</h3>
            <button onclick="testApiBase()">Test API_BASE</button>
            <div id="api-base-result"></div>
        </div>
        
        <div class="debug">
            <h3>Step 2: Test Direct API Call</h3>
            <input type="text" id="test-name" placeholder="Campaign Name" value="Debug Test">
            <input type="url" id="test-url" placeholder="Destination URL" value="https://spotify.com/debug">
            <button onclick="testApiCall()">Test API Call</button>
            <div id="api-call-result"></div>
        </div>
        
        <div class="debug">
            <h3>Step 3: Test Form Submission</h3>
            <form id="debug-form">
                <input type="text" name="name" placeholder="Campaign Name" value="Form Test" required>
                <input type="url" name="destination_url" placeholder="Destination URL" value="https://spotify.com/form" required>
                <button type="submit">Submit Form</button>
            </form>
            <div id="form-result"></div>
        </div>
        
        <div class="debug">
            <h3>Console Logs:</h3>
            <div id="console-logs"></div>
        </div>

        <script>
            // Capture console logs
            const originalLog = console.log;
            const originalError = console.error;
            let logs = [];
            
            console.log = function(...args) {
                logs.push('LOG: ' + args.join(' '));
                updateConsoleLogs();
                originalLog.apply(console, args);
            };
            
            console.error = function(...args) {
                logs.push('ERROR: ' + args.join(' '));
                updateConsoleLogs();
                originalError.apply(console, args);
            };
            
            function updateConsoleLogs() {
                document.getElementById('console-logs').innerHTML = logs.slice(-10).join('<br>');
            }
            
            // API Configuration - auto-detect current domain
            const API_BASE = window.location.origin;
            console.log("API_BASE:", API_BASE);
            
            function testApiBase() {
                const result = document.getElementById('api-base-result');
                result.innerHTML = \`
                    <strong>API_BASE:</strong> "\${API_BASE}"<br>
                    <strong>Expected URL:</strong> \${API_BASE}/api/campaigns<br>
                    <strong>Status:</strong> \${API_BASE ? 'Configured' : 'Using same-origin'}
                \`;
                result.className = API_BASE ? 'success' : 'error';
            }
            
            async function testApiCall() {
                const result = document.getElementById('api-call-result');
                const name = document.getElementById('test-name').value;
                const url = document.getElementById('test-url').value;
                
                try {
                    console.log('Testing API call...');
                    const apiUrl = API_BASE + '/api/campaigns';
                    console.log('Making request to:', apiUrl);
                    
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({ name, destination_url: url })
                    });
                    
                    console.log('Response status:', response.status);
                    const data = await response.json();
                    console.log('Response data:', data);
                    
                    if (response.ok) {
                        result.innerHTML = \`
                            <strong>✅ SUCCESS!</strong><br>
                            Campaign ID: \${data.id}<br>
                            Smart Link: <a href="\${data.smart_link_url}" target="_blank">\${data.smart_link_url}</a>
                        \`;
                        result.className = 'success';
                    } else {
                        throw new Error(\`\${response.status}: \${data.error || 'Unknown error'}\`);
                    }
                } catch (error) {
                    console.error('API call failed:', error);
                    result.innerHTML = \`<strong>❌ FAILED:</strong> \${error.message}\`;
                    result.className = 'error';
                }
            }
            
            document.getElementById('debug-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Form submitted');
                
                const result = document.getElementById('form-result');
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());
                
                try {
                    console.log('Form data:', data);
                    const apiUrl = API_BASE + '/api/campaigns';
                    console.log('Form making request to:', apiUrl);
                    
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify(data)
                    });
                    
                    console.log('Form response status:', response.status);
                    const responseData = await response.json();
                    console.log('Form response data:', responseData);
                    
                    if (response.ok) {
                        result.innerHTML = \`
                            <strong>✅ FORM SUCCESS!</strong><br>
                            Campaign: \${responseData.name}<br>
                            Smart Link: <a href="\${responseData.smart_link_url}" target="_blank">\${responseData.smart_link_url}</a>
                        \`;
                        result.className = 'success';
                    } else {
                        throw new Error(\`\${response.status}: \${responseData.error || 'Unknown error'}\`);
                    }
                } catch (error) {
                    console.error('Form submission failed:', error);
                    result.innerHTML = \`<strong>❌ FORM FAILED:</strong> \${error.message}\`;
                    result.className = 'error';
                }
            });
            
            // Test API_BASE on load
            testApiBase();
        </script>
    </body>
    </html>
  `);
});

export default router;
