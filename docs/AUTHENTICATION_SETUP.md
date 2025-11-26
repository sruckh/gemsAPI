# Authentication Setup Guide

This guide explains how to set up Google OAuth authentication for the gemsAPI web interface.

## Overview

The gemsAPI application requires Google OAuth authentication to access the web interface for managing AI gems and prompts. The application uses a "first user becomes admin" approach - the first person to sign in automatically becomes an administrator.

## Prerequisites

1. **Supabase Project**: You need a Supabase project with Google OAuth configured
2. **Google Cloud Project**: Google OAuth credentials for your Supabase project
3. **Node.js**: For running the frontend development server

## Step 1: Configure Supabase Google OAuth

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project or use an existing one
3. Note your project URL and anon key from Settings > API

### 1.2 Enable Google OAuth Provider
1. In your Supabase project, go to **Authentication > Providers**
2. Enable the **Google** provider
3. Configure the following settings:
   - **Client ID**: Your Google OAuth client ID
   - **Client Secret**: Your Google OAuth client secret
   - **Redirect URL**: `https://[your-project-ref].supabase.co/auth/v1/callback`
   - **Enabled**: true

### 1.3 Create Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Go to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Select **Web application**
6. Configure:
   - **Name**: gemsAPI (or your app name)
   - **Authorized JavaScript origins**: `http://localhost:5173` (for development)
   - **Authorized redirect URIs**: `https://[your-project-ref].supabase.co/auth/v1/callback`

## Step 2: Database Setup

### 2.1 Run Database Setup Script
1. Copy the contents of `docs/supabase/gems_table.sql`
2. Go to your Supabase project > SQL Editor
3. Paste and run the SQL script

This creates:
- `gems` table for storing AI prompts and configurations
- `admin_users` table for authentication and authorization
- Proper indexes and Row Level Security policies

### 2.2 Verify Tables
After running the script, you should see:
- `gems` table with sample data
- `admin_users` table (empty initially)

## Step 3: Frontend Configuration

### 3.1 Environment Variables
Create a `.env.local` file in the project root with your Supabase credentials:

```bash
# Frontend Environment Variables
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

**Important**: Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with your actual values from Step 1.1.

### 3.2 Environment Variables for Different Environments

#### Development (.env.local)
```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Production Environment
Set these as environment variables in your hosting platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Step 4: Authentication Flow

### 4.1 First User Setup (Admin Registration)
1. Start the application: `npm run dev`
2. Open http://localhost:5173
3. Click "Sign in with Google"
4. Complete Google OAuth flow
5. **First user automatically becomes admin**
6. Subsequent users need to be manually added to `admin_users` table

### 4.2 Admin User Management
To add additional admin users manually:
1. Go to Supabase > Table Editor > admin_users
2. Insert new records with:
   - `email`: User's email address
   - `role`: 'admin' (or 'super_admin' for full access)

## Step 5: Backend Configuration

### 5.1 Environment Variables
The backend FastAPI server already uses these environment variables (configured in `.env`):
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase service role key
- `API_TOKEN`: Backend authentication token

### 5.2 Database Permissions
The SQL script automatically sets up Row Level Security (RLS) policies:
- Service role has full access to tables
- Anonymous users have no direct database access
- All access goes through the FastAPI backend

## Security Considerations

### Frontend Security
- Only authenticated admin users can access the web interface
- Google OAuth provides secure authentication
- Supabase handles session management securely

### Backend Security
- API endpoints are protected by Supabase RLS policies
- Service role key is used for database operations
- No hardcoded credentials in the codebase

### Database Security
- Row Level Security enabled on all tables
- Admin users table restricts who can manage gems
- UUID primary keys prevent enumeration attacks

## Troubleshooting

### Common Issues

#### 1. Google OAuth Not Working
- **Check**: Google Cloud Console redirect URIs match exactly
- **Check**: Supabase Google provider is properly configured
- **Check**: JavaScript origins include `http://localhost:5173`

#### 2. Database Connection Issues
- **Check**: Supabase URL and keys in environment variables
- **Check**: RLS policies are properly applied
- **Check**: Service role key has proper permissions

#### 3. Admin Registration Not Working
- **Check**: Backend endpoints are accessible
- **Check**: Supabase client configuration in frontend
- **Check**: Network connectivity between frontend and backend

#### 4. Frontend Build Issues
- **Check**: `.env.local` is properly configured
- **Check**: All dependencies are installed: `npm install`
- **Check**: Vite configuration in `vite.config.ts`

### Debug Mode
To debug authentication issues:
1. Open browser developer tools
2. Check Console tab for JavaScript errors
3. Check Network tab for failed API requests
4. Check Supabase logs for authentication events
5. Check backend logs for database operation errors

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Production Deployment
1. Build the frontend: `npm run build`
2. Deploy the `dist/` folder to your hosting service
3. Set environment variables in your hosting platform
4. Ensure backend API is accessible at `/api/*` endpoints

## API Endpoints Reference

### Authentication Endpoints
- `POST /api/auth/check-admin`: Check if user email is in admin_users table
- `POST /api/auth/register-admin`: Register first user as admin (only if no admin exists)

### Gems Management Endpoints (existing, unchanged)
- `GET /api/gems`: Get all gems
- `POST /api/gems`: Create new gem
- `PUT /api/gems/{id}`: Update existing gem
- `DELETE /api/gems/{id}`: Delete gem

### Generation Endpoints (existing, unchanged)
- `POST /api/gemini/generate`: Generate content with Gemini
- `POST /api/gems/execute`: Execute named gem with user prompt

## Support

For issues with authentication setup:
1. Check the [Supabase documentation](https://supabase.com/docs)
2. Check the [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2)
3. Review application logs and browser console errors
4. Verify all environment variables are correctly set