# 🥘 Bihari Chatkara RMS
> **Authentic Taste. Intelligent Management.**

Bihari Chatkara is a professional-grade Restaurant Management System (RMS) built to handle high-volume dining operations. It features a hybrid cloud/local data layer, an AI-powered culinary co-pilot, and an enterprise POS.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev/)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini_3-indigo)](https://ai.google.dev/)

---

## ✨ Features

- **⚡ High-Performance POS**: Multi-terminal support with real-time table sync.
- **👨‍🍳 Smart KDS**: Kitchen Display System with visual/audio alerts for orders > 15 mins.
- **🤖 AI Co-Pilot**: Gemini 3 integrated for recipe generation, menu descriptions, and sales insights.
- **📦 Inventory & Procurement**: Recipe-based stock deduction and PO generation.
- **📊 Executive Analytics**: Deep-dive into cash vs. digital collections and profitability.
- **☁️ Hybrid Sync**: Works offline (LocalStorage) and syncs instantly when the Node/MySQL backend is detected.

## 🛠️ Tech Stack

- **Frontend**: React 18, Tailwind CSS, Recharts, Lucide.
- **AI**: Google Gemini 3 (Pro/Flash).
- **Backend**: Node.js (Express), MySQL 8.
- **Infrastructure**: Vite (Build tool), Vercel/Hostinger compatible.

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- MySQL (Optional for cloud mode)

### 2. Installation
```bash
git clone https://github.com/your-username/bihari-chatkara-rms.git
cd bihari-chatkara-rms
npm install
```

### 3. Setup
Create a `.env` file based on the provided `.env.example`:
```bash
cp .env.example .env
```
Add your `API_KEY` from [Google AI Studio](https://aistudio.google.com/).

### 4. Run Development
```bash
# Frontend only
npm run dev

# Fullstack (Backend Server)
npm run server
```

## 🔐 Credentials (Default)
| Role | Email | Password |
| :--- | :--- | :--- |
| **Manager** | `admin@biharichatkara.com` | `admin123` |
| **Chef** | `chef@biharichatkara.com` | `chef123` |
| **Staff** | `server@biharichatkara.com` | `server123` |

---
*Developed for Bihari Chatkara – Preserving the legacy of Bihari cuisine through technology.*