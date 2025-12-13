
# 🥘 Bihari Chatkara - Restaurant Management System (RMS)

A modern, comprehensive, and cloud-ready Restaurant Management System built to streamline operations from the table to the back office.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-5-purple)
![Tailwind](https://img.shields.io/badge/Tailwind-3-cyan)
![Node](https://img.shields.io/badge/Node.js-18+-green)

## 🚀 Features

*   **Point of Sale (POS)**: Intuitive touch-interface for table management, order taking, and billing. Supports split payments and custom items.
*   **Kitchen Display System (KDS)**: Real-time ticket management with color-coded urgency and preparation status tracking.
*   **Inventory & Procurement**: Ingredient-level stock tracking with automated low-stock alerts and purchase requisition workflow (Chef → Manager → PO).
*   **Staff Management**: Role-based access control (RBAC) for Managers, Chefs, and Servers with custom permission toggles.
*   **Financials**: Expense tracking, daily sales reporting, and visual revenue analytics.
*   **Hybrid Data Architecture**:
    *   **Cloud Mode**: Connects to a robust MySQL backend for production.
    *   **Local Demo Mode**: Automatically falls back to browser `localStorage` if the backend is unreachable, making it perfect for demos and offline testing.

## 🛠️ Tech Stack

*   **Frontend**: React 18, Tailwind CSS, Lucide React (Icons), Recharts (Analytics).
*   **Build Tool**: Vite.
*   **Backend**: Node.js, Express.
*   **Database**: MySQL (using `mysql2` with connection pooling).
*   **Deployment**: Ready for Vercel/Netlify (Frontend) and Google Cloud Run/App Engine (Backend).

## ⚡ Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   npm or yarn
*   *(Optional)* MySQL Server for full-stack mode.

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/bihari-chatkara-rms.git
cd bihari-chatkara-rms
npm install
```

### 2. Configuration

Create a `.env` file in the root directory. You can use the example below:

```env
# --- BACKEND CONFIGURATION (Only for Full Stack Mode) ---
PORT=8080

# Database Credentials
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=chatkara

# Google Cloud SQL (Optional - Production)
# INSTANCE_CONNECTION_NAME=project:region:instance
```

### 3. Running the Application

#### Option A: Local Demo Mode (Frontend Only)
*Ideal for quick testing or portfolios. No database required.*

The app detects if the backend is unreachable and automatically switches to using your browser's Local Storage.

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Option B: Full Stack Mode
*Production simulation with MySQL.*

1. Ensure your MySQL server is running.
2. The server automatically creates tables and seeds default data on the first run.

```bash
# Terminal 1: Start the Backend API
npm start

# Terminal 2: Start the Frontend
npm run dev
```

## 🔐 Default Credentials

When running in **Local Demo Mode** (or after fresh DB seeding), use these credentials:

| Role | Email | Password |
|------|-------|----------|
| **Admin/Manager** | `admin@biharichatkara.com` | `admin123` |
| **Chef** | `chef@biharichatkara.com` | `chef123` |
| **Server** | `server@biharichatkara.com` | `server123` |

## 📦 Deployment

### Frontend (Static)
Run the build command to generate the `dist` folder.
```bash
npm run build
```
Upload the `dist` folder to any static host (Vercel, Netlify, GitHub Pages, Hostinger).

### Backend (API)
The `server.js` is production-ready.
1. Set `NODE_ENV=production`.
2. Configure environment variables on your cloud provider.
3. Deploy to platforms like Google Cloud Run, Heroku, or DigitalOcean App Platform.

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
