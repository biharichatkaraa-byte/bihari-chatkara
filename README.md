
# Bihari Chatkara - Restaurant Management System (RMS)

A comprehensive, cloud-ready Restaurant Management System built with React, Vite, Express, and MySQL. This application handles Point of Sale (POS), Kitchen Display Systems (KDS), Inventory Management, Staff Roles, and Procurement.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-5-purple)
![Tailwind](https://img.shields.io/badge/Tailwind-3-cyan)

## Features

*   **Point of Sale (POS)**: Table management, quick ordering, custom items, and bill printing.
*   **Kitchen Display System (KDS)**: Real-time order ticking, color-coded urgency, and "Chef AI" recipe assistance.
*   **Advanced Order History**: Detailed transaction logs with filtering by Date, Time, Payment Method (Cash/Card/UPI), and Status.
*   **Inventory**: Ingredient tracking, menu cost analysis, and low-stock alerts.
*   **Procurement**: Purchase requisition workflow (Chef request -> Manager approve -> Purchase Order).
*   **Expenses**: Operational cost tracking and budgeting.
*   **Staff Management**: Role-based access control (Manager, Chef, Server).
*   **Hybrid Data Mode**: Works with a local backend/MySQL or falls back to browser LocalStorage for demos automatically.

## Tech Stack

*   **Frontend**: React 18, Tailwind CSS, Lucide React, Recharts.
*   **Build Tool**: Vite.
*   **Backend**: Node.js, Express.
*   **Database**: MySQL (via mysql2) or Cloud SQL.

## Getting Started

### Prerequisites

*   Node.js (v18+)
*   MySQL Database (Optional, for production mode)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/bihari-chatkara-rms.git
    cd bihari-chatkara-rms
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Set up Environment Variables:
    Copy `.env.example` to `.env`.
    ```bash
    cp .env.example .env
    ```
    If you are running the backend, update `.env` with your MySQL credentials. If you just want to run the frontend in **Demo Mode**, you can skip this step or leave the defaults.

### Running Locally (Development)

1.  **Frontend Only (Demo Mode)**:
    Runs the React app with LocalStorage (no database required).
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000).

2.  **Full Stack (Frontend + Backend)**:
    Ensure your MySQL server is running and credentials are in `.env`.
    
    *Terminal 1 (Backend):*
    ```bash
    npm start
    ```
    
    *Terminal 2 (Frontend):*
    ```bash
    npm run dev
    ```

### Building for Production

To create a production build (outputs to `dist/`):

```bash
npm run build
```

## Project Structure

*   `/components` - React UI components (POS, KDS, Dashboard, etc.)
*   `/services` - API adapters and Logic (DB connection, AI service).
*   `App.tsx` - Main routing and layout logic.
*   `server.js` - Node.js Express server for MySQL connectivity.
*   `types.ts` - TypeScript interfaces.

## Demo Credentials

The application comes with a **Demo Mode** enabled by default. Click the role buttons on the login screen or use:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@biharichatkara.com` | `admin123` |
| **Chef** | `chef@biharichatkara.com` | `chef123` |
| **Staff** | `server@biharichatkara.com` | `server123` |

## License

MIT License. See [LICENSE](LICENSE) for details.
