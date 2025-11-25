
# Deployment Guide (Standalone Mode)

This application is designed to run as a **Standalone Single Page Application (SPA)**. This means:
- No Database Setup is required (it uses your browser's Local Storage).
- No Backend Server (Node.js) is required.
- You can host it on **any** static hosting provider (Hostinger, Netlify, Vercel, GitHub Pages).

## 1. Prepare for Production
1. Open your project folder.
2. Create a file named `.env` in the root directory (if it doesn't exist).
3. Add your Google Gemini API Key inside `.env`:
   ```
   VITE_API_KEY=your_actual_api_key_here
   ```
   *(Note: Ensure your code uses `import.meta.env.VITE_API_KEY` or the appropriate method for your build system. If using the provided `services/geminiService.ts`, ensure your build tool injects `process.env.API_KEY`).*

## 2. Build the Application
Run the build command to generate the static files:

```bash
npm run build
```

This will create a `dist` folder in your project root. This folder contains:
- `index.html`
- `assets/` (JavaScript and CSS files)

## 3. Upload to Hostinger (or any host)
1. **Log in to Hostinger hPanel**.
2. Go to **Files** -> **File Manager**.
3. Open the `public_html` folder.
4. **Delete** any existing files (like `default.php`).
5. **Upload** the **contents** of your local `dist` folder into `public_html`.
   - *Ensure `index.html` is directly inside `public_html`, not inside a subfolder.*

## 4. Fix Routing (Important)
Since this is a React app, refreshing a page like `/pos` might cause a 404 error on some servers.

1. In **File Manager** (`public_html`), create a new file named `.htaccess`.
2. Paste this code:

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

## 5. Done!
Visit your website URL. The app will load immediately.
- Login with the demo credentials (e.g., `admin@biharichatkara.com` / `admin123`).
- Data will be saved to your browser automatically.
