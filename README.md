
# Bihari Chatkara - Restaurant Management System (RMS)

A comprehensive, cloud-ready Restaurant Management System built with React, Vite, Express, and MySQL. This application handles Point of Sale (POS), Kitchen Display Systems (KDS), Inventory Management, Staff Roles, and Procurement.

## Features

*   **Point of Sale (POS)**: Table management, quick ordering, custom items, and bill printing.
*   **Kitchen Display System (KDS)**: Real-time order ticking, color-coded urgency, and "Chef AI" recipe assistance.
*   **Inventory**: Ingredient tracking, menu cost analysis, and low-stock alerts.
*   **Procurement**: Purchase requisition workflow (Chef request -> Manager approve -> Purchase Order).
*   **Expenses**: Operational cost tracking and budgeting.
*   **Staff Management**: Role-based access control (Manager, Chef, Server).
*   **Hybrid Data Mode**: Works with a local backend/MySQL or falls back to browser LocalStorage for demos.

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
    Copy `.env.example` to `.env` and fill in your database credentials.
    ```bash
    cp .env.example .env
    ```

### Running Locally (Development)

Run the frontend development server:

```bash
npm run dev
```

Run the backend server (optional, required for MySQL features):

```bash
npm start
```

## Deployment

1.  Build the frontend:
    ```bash
    npm run build
    ```

2.  Deploy the `dist/` folder to your static host, or run `node server.js` to serve both API and Static files in a production environment (e.g., Google App Engine, Heroku).

## License

Private / Proprietary.
