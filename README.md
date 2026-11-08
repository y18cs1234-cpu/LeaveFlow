# LeaveFlow — Multi-user Leave Management Demo

A starter leave-request and approval application using:
- **Frontend:** HTML, CSS and JavaScript
- **Authentication + database:** Supabase
- **Source control:** GitHub
- **Hosting:** GitHub Pages (or another static host)

This is a learning/demo starter, not a production HR system. Use test accounts and sample data only.

## What works in this starter

- Employee sign-up and sign-in using Supabase Auth
- New accounts automatically receive the `employee` role
- Employees submit leave requests and see their own request history
- Managers see the approval queue and approve/reject requests
- HR admins see all leave requests
- Row Level Security (RLS) policies enforce access in the database

## Important security design

- The browser uses only the Supabase **anon/publishable key**.
- Never put a Supabase `service_role` key in `app.js` or any browser code.
- Roles are not selected during public sign-up. New users are always employees.
- Promote manager/HR test accounts manually from the Supabase SQL Editor.
- RLS policies protect the database even if someone bypasses the website UI.

This starter lets any manager review all demo requests. For a real company, add manager-to-team mapping and restrict approvals to each manager's reporting team before using real employee data.

## Step 1 — Create a Supabase project

1. Create a project at https://supabase.com/
2. Open **Project Settings → API** (or the API Keys page).
3. Copy the Project URL and the anon/publishable key.
4. Open `app.js` and replace:
   - `YOUR_SUPABASE_PROJECT_URL`
   - `YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY`

Do not use the `service_role` / secret key in the browser.

## Step 2 — Create the database and security policies

1. In Supabase, open **SQL Editor**.
2. Open `supabase-setup.sql` from this project.
3. Copy and run the full SQL script.
4. The script creates `profiles` and `leave_requests`, a sign-up trigger, indexes and RLS policies.

## Step 3 — Run locally

For a quick local test, open `index.html` in a browser. If your browser blocks any local script behavior, use VS Code Live Server or another simple local web server.

## Step 4 — Create test accounts

1. Open the app and choose **Create account**.
2. Create an employee account, for example `employee1@example.com`.
3. Create another account for a manager, for example `manager@example.com`.
4. If email confirmation is enabled in Supabase, confirm each account from the email before signing in.
5. In Supabase **Authentication → Users**, confirm the accounts exist.
6. In Supabase **SQL Editor**, run this command, replacing the email with your manager test account:

```sql
update public.profiles
set role = 'manager'
where email = 'manager@example.com';
```

7. Sign in as the employee and submit a test leave request.
8. Sign out, sign in as the manager and approve/reject the request.

Optional HR account:

```sql
update public.profiles
set role = 'hr_admin'
where email = 'hr@example.com';
```

## Step 5 — Publish using GitHub Pages

1. Create a GitHub repository, for example `leaveflow-demo`.
2. Upload `index.html`, `styles.css`, `app.js`, `supabase-setup.sql` and `README.md`.
3. Commit the files to `main`.
4. Open repository **Settings → Pages**.
5. Choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
6. Wait for deployment. GitHub will show the published URL in the Pages section.
7. Add that URL to Supabase **Authentication → URL Configuration → Site URL / Redirect URLs** as appropriate.

GitHub Pages hosts the static frontend. Supabase remains the shared backend/database, so different users see the same server-side requests subject to RLS policies.

## Current demo limitations

- Leave allowance cards are illustrative sample values, not calculated balances.
- Date overlap checks, holiday calendars, half-days, attachments, email notifications and audit exports are not included yet.
- Manager access is global for this demo, not limited to a reporting hierarchy.
- There is no production-grade HRIS integration or Workday connection yet.
- Do not use this starter to process real employee leave or sensitive personal data without a security review, privacy review, tested backup/retention process and appropriate access controls.

## Suggested next improvements

1. Manager-to-employee reporting hierarchy.
2. Leave balance ledger and business-day calculation.
3. Email notifications for request and decision.
4. HR configuration for leave types and holiday calendars.
5. Workday integration using a secure backend service (never expose Workday credentials in browser JavaScript).
