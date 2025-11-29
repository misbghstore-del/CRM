---
description: How to deploy the CRM app to Vercel for free
---

# Deploying BDM CRM to Vercel

This guide will help you host your application for free using Vercel (frontend/backend) and Supabase (database).

## Prerequisites

1.  **GitHub Account**: You need to push your code to a GitHub repository.
2.  **Vercel Account**: Sign up at [vercel.com](https://vercel.com) using your GitHub account.
3.  **Supabase Project**: You already have this!

## Step 1: Initialize Git and Push to GitHub

Since your project isn't a git repository yet, run these commands in your terminal:

```bash
git init
git add .
git commit -m "Initial commit"
```

Then, create a new **empty repository** on GitHub (do not add README or .gitignore).
Copy the commands shown on GitHub (under "...or push an existing repository from the command line") and run them:

```bash
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## Step 2: Import to Vercel

1.  Go to your Vercel Dashboard.
2.  Click **"Add New..."** -> **"Project"**.
3.  Find your `CRM` repository and click **"Import"**.

## Step 3: Configure Project

1.  **Framework Preset**: Vercel should auto-detect "Next.js".
2.  **Root Directory**: Leave as `./` (or select `CRM` if it's in a subfolder).
3.  **Environment Variables**: This is critical! You need to copy your `.env.local` values here.
    - Expand the "Environment Variables" section.
    - Add the following keys and values from your local `.env.local` file:
      - `NEXT_PUBLIC_SUPABASE_URL`
      - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      - `SUPABASE_SERVICE_ROLE_KEY` (Required for admin actions)
      - `NEXT_PUBLIC_APP_URL` (Set this to your Vercel URL after deployment, e.g., `https://your-project.vercel.app`, or use `http://localhost:3000` for now and update later).

## Step 4: Deploy

1.  Click **"Deploy"**.
2.  Wait for the build to complete.
3.  Once finished, you'll get a live URL (e.g., `https://bdm-crm.vercel.app`).

## Step 5: Update Supabase Auth Settings

1.  Go to your **Supabase Dashboard** -> **Authentication** -> **URL Configuration**.
2.  Add your new Vercel URL (e.g., `https://bdm-crm.vercel.app`) to the **Site URL** and **Redirect URLs**.
    - This ensures users can log in and be redirected back to the live site, not localhost.

## Step 6: Verify

Visit your new URL and try logging in!
