# Database Migration Guide

This directory contains the database migration scripts for Audit Wolf.

## Setup Instructions

### 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project or use existing project
3. Note down your project URL and API keys

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env` in the backend directory
2. Update the Supabase configuration:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### 3. Create Database Tables

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `001_initial_schema.sql`
4. Paste and run the SQL in the editor
5. Verify tables are created successfully

### 4. Verify Migration

Run the migration verification script:

```bash
npm run migrate
```

This will verify that all tables exist and are accessible.

## Database Schema

The migration creates the following tables:

### Users Table

- Extends Supabase auth with additional user profile data
- Tracks subscription tier and API credits
- Includes created/updated timestamps

### Contracts Table

- Stores uploaded Solidity contracts
- Links to users via foreign key
- Includes source code, compiler version, and file hash

### Audits Table

- Tracks audit jobs and their status
- Stores analysis results (static and AI)
- Links to contracts and users
- Includes IPFS and blockchain transaction references

### Vulnerabilities Table

- Detailed vulnerability records from audits
- Categorized by type and severity
- Includes location information and recommendations
- Links to parent audit

## Row Level Security (RLS)

The schema includes RLS policies to ensure:

- Users can only access their own data
- Proper authentication is required
- Data isolation between users

## Indexes

Performance indexes are created for:

- User lookups
- Contract queries by user
- Audit status and date filtering
- Vulnerability severity and type filtering

## Troubleshooting

### Connection Issues

- Verify environment variables are correct
- Check Supabase project status
- Ensure service role key has proper permissions

### Table Creation Issues

- Run SQL manually in Supabase Dashboard
- Check for syntax errors in migration file
- Verify database permissions

### RLS Policy Issues

- Ensure auth.uid() is available
- Check user authentication status
- Verify policy conditions match your use case
