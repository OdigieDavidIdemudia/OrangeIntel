# OrangeIntel

OrangeIntel is a premium Threat Intelligence Assessment (TIA) platform designed for analysts. It aggregates threat feeds, performs automated analysis (including IOC extraction), and generates deployment-ready reports.

## Features
- **Analyst Dashboard**: High-risk threat prioritization with a "Cyber" aesthetic.
- **Threat Explorer**: Full search and filter capabilities across ingested intelligence.
- **Automated Analysis**:
  - **Relevance Scoring**: Keyword and heuristic based scoring.
  - **IOC Extraction**: Auto-detection of IPs, Emails, and Hashes.
- **Report Builder**: WYSIWYG editor for assessments.
- **DOCX Export**: One-click generation of formatted Word reports.

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS, Framer Motion
- **Backend**: Go (Golang), SQLite (AES-256 Encrypted)
- **Distribution**: Electron

## Getting Started

### Prerequisites
- Node.js (v18+)
- Go (v1.21+)

### Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run in development mode (Frontend + Backend + Electron):
   ```bash
   npm run dev
   ```

### Building for Production
To create a standalone Windows application:
```bash
npm run dist
```
- **Output**: `dist_electron/win-unpacked/OrangeIntel.exe`
- **Installer**: `dist_electron/OrangeIntel Setup 1.0.0.exe` (requires internet for signing tools)

## Configuration
- **API Keys**: Configure feed sources in `backend/ingest/engine.go` (or via `.env` if extended).
- **Database**: Stores data locally in `orangeintel.db`.

## License
Proprietary / Internal Use.
