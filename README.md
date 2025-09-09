# Audit Wolf

A comprehensive smart contract auditing platform that combines AI-powered analysis with traditional static analysis tools to provide detailed security assessments of Solidity contracts.

## Project Structure

```
audit-wolf/
├── frontend/          # Next.js frontend application
├── backend/           # Express.js backend API
├── package.json       # Root package.json for workspace management
└── README.md
```

## Tech Stack

### Frontend

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Shadcn UI** for component library
- **React** for UI components

### Backend

- **Node.js** with Express.js
- **TypeScript** for type safety
- **Supabase** for database and authentication
- **LangChain** with OpenRouter for AI analysis
- **Slither** for static analysis
- **Bull Queue** with Redis for job processing

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd audit-wolf
```

2. Install dependencies for all projects:

```bash
npm run install:all
```

3. Set up environment variables:

**Backend (.env):**

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

**Frontend (.env.local):**

```bash
cp frontend/.env.local.example frontend/.env.local
# Edit frontend/.env.local with your configuration
```

### Development

Start both frontend and backend in development mode:

```bash
npm run dev
```

Or start them individually:

```bash
# Backend only (runs on http://localhost:3001)
npm run dev:backend

# Frontend only (runs on http://localhost:3000)
npm run dev:frontend
```

### Building for Production

Build both applications:

```bash
npm run build
```

### Project Configuration

The project is set up with:

- ✅ Next.js with TypeScript and Tailwind CSS
- ✅ Shadcn UI component library
- ✅ Express.js backend with TypeScript
- ✅ Environment variable configuration
- ✅ Workspace management with root package.json
- ✅ Development scripts for concurrent running
- ✅ Basic project structure and types

## Features Implemented

### ✅ Task 1: Project Structure and Configuration

- Next.js frontend with TypeScript and Tailwind CSS
- Express.js backend with TypeScript
- Environment variable configuration
- Workspace management

### ✅ Task 2: Database Models and Supabase Integration

- Supabase project configuration
- TypeScript interfaces for all models
- Database migration scripts
- Connection utilities

### ✅ Task 3: Authentication System

- Supabase Auth integration
- Login/register components with validation
- Protected route middleware
- JWT token handling and session management

### ✅ Task 4: Contract Input and Validation

- ContractUploader component with file upload and code paste
- Solidity syntax validation and error display
- File size validation (10MB limit)
- Contract storage service

### ✅ Task 5: Static Analysis Integration

- **Slither analyzer integration** with comprehensive error handling
- **AST parsing functionality** for Solidity contracts
- **Configurable detectors** and timeout management
- **Vulnerability mapping** to standardized format
- **Background analysis processing** with progress tracking
- **API endpoints** for analysis management
- **Unit tests** with mocked Slither output

## Static Analysis Features

The Slither integration provides:

- **Automated Security Analysis**: Detects reentrancy, access control, and other vulnerabilities
- **Gas Optimization**: Identifies opportunities to reduce gas costs
- **Best Practice Validation**: Ensures code follows Solidity best practices
- **Real-time Progress**: Track analysis progress with status updates
- **Comprehensive Reporting**: Detailed vulnerability reports with recommendations

### Installation Requirements

For static analysis functionality, install Slither:

**Linux/macOS:**

```bash
chmod +x backend/scripts/install-slither.sh
./backend/scripts/install-slither.sh
```

**Windows:**

```cmd
backend\scripts\install-slither.bat
```

**Manual Installation:**

```bash
pip install slither-analyzer
```

### API Endpoints

- `POST /api/analysis/start` - Start static analysis
- `GET /api/analysis/:auditId/progress` - Get analysis progress
- `GET /api/analysis/:auditId/results` - Get analysis results
- `POST /api/analysis/validate` - Validate contract code
- `GET /api/analysis/health` - Check system health

## Next Steps

1. ~~Configure Supabase database and authentication~~ ✅
2. Set up AI analysis pipeline with LangChain and OpenRouter
3. ~~Integrate Slither for static analysis~~ ✅
4. ~~Implement contract upload and validation~~ ✅
5. Build audit dashboard and reporting system
6. Implement report generation and PDF export
7. Set up email delivery system
8. Add IPFS and blockchain storage

## Requirements Addressed

- **1.1-1.5**: Contract input and validation system ✅
- **2.1-2.2**: Static analysis integration with Slither ✅
- **2.6**: Error handling for analysis failures ✅
- **4.5**: Database integration with Supabase ✅
- **5.1**: Background job processing architecture ✅
- **6.1**: Modern, responsive design using Tailwind CSS and Shadcn UI ✅
- **6.2**: Support for both dark and light themes ✅
- **7.1**: Authentication system with Supabase Auth ✅
- **7.3**: JWT token handling and session management ✅
