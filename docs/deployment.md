# Alveryn Production Deployment

This project is configured for a Render-based production deploy:

- `alveryn-web`: static React/Vite frontend
- `alveryn-admin`: private static React/Vite administration portal
- `alveryn-api`: Dockerized Spring Boot backend
- `alveryn-db`: managed PostgreSQL database

## Domains

Use these production hostnames:

- Frontend: `https://alveryn.com`
- Frontend alias: `https://www.alveryn.com`
- Admin portal: `https://alveryn-admin.onrender.com`
- Backend API: `https://api.alveryn.com`

## Render setup

1. Open Render and create a new Blueprint from the GitHub repository:
   `https://github.com/ejacot/alveryn`
2. Select branch:
   `main`
3. Render reads `render.yaml` and creates:
   - `alveryn-web`
   - `alveryn-admin`
   - `alveryn-api`
   - `alveryn-db`
4. When Render asks for unsynced secret values, set:
   - `MAIL_PASSWORD`

The Blueprint sets `FOUNDER_EMAIL` for the private administration portal. Only that matching
account receives the `ADMIN` role; changing it requires a reviewed deployment configuration
change and an API restart. The public application contains no link or route to this portal.

The app generates `JWT_SECRET` automatically through the blueprint.

## DNS

After Render creates the services, open each service's Custom Domains page and copy the DNS targets Render provides.

Configure DNS for:

- `alveryn.com` -> Render target for `alveryn-web`
- `www.alveryn.com` -> Render target for `alveryn-web`
- `api.alveryn.com` -> Render target for `alveryn-api`

Keep Cloudflare proxy disabled until Render verifies the custom domains and issues TLS certificates. After verification, proxying can be enabled if needed.

## Backend production environment

The production environment is defined in `render.yaml`.

Important values:

- `CORS_ALLOWED_ORIGINS=https://alveryn.com,https://www.alveryn.com,https://alveryn-admin.onrender.com`
- `FRONTEND_VERIFICATION_URL=https://alveryn.com/verify-email`
- `GOOGLE_OAUTH_REDIRECT_URI=https://api.alveryn.com/api/auth/oauth/google/callback`
- `REFRESH_COOKIE_SECURE=true`
- `REFRESH_COOKIE_SAME_SITE=None` (required because the private portal and API use different sites)

Google OAuth is configured but the frontend login button is currently hidden. Add Google credentials only when the feature is re-enabled publicly:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

## Frontend production environment

The frontend is built by Render with:

```sh
cd frontend && npm ci && npm run build
```

Production API target:

```sh
VITE_API_BASE_URL=https://api.alveryn.com
```

The private admin frontend uses the same dependencies but a separate entry point and output:

```sh
cd frontend && npm ci && npm run build:admin
```

It is published from `frontend/dist-admin` and does not include registration, onboarding, or
customer navigation. API authorization remains the security boundary; knowing the portal URL
does not grant access.

## Smoke test checklist

After deployment:

1. Open `https://alveryn.com`.
2. Register a new account.
3. Verify email delivery from `studio365media@gmail.com`.
4. Complete onboarding.
5. Create a time-based Work Type.
6. Create a unit-based Work Type and Unit Types.
7. Create a Work Entry.
8. Confirm Dashboard, Calendar, Settings and Statistics load.
9. Install to iPhone Home Screen and verify standalone display.
10. Open `https://alveryn-admin.onrender.com`, verify the Founder account can sign in, and verify a customer account is rejected.

## Rollback

Render supports rollbacks from each service's Deploys page.

Rollback order if a deploy is bad:

1. Roll back `alveryn-api`.
2. Roll back `alveryn-web`.
3. Do not roll back database migrations manually unless a specific rollback migration exists.
