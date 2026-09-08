This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3003](http://localhost:3003) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Vercel OAuth setup

The dashboard's "recent deployments" panel connects to Vercel through a Vercel OAuth App (not a personal access token), created with the Vercel CLI's `oauth-apps` commands.

### Development

Register a dev-only OAuth app and point it at your local callback URL:

```bash
vercel oauth-apps register --name "Karasu Lab - Dev" --slug karasu-lab-dev \
  --redirect-uri "http://localhost:3003/api/auth/callback/vercel" --format json
vercel oauth-apps install --client-id <id> --permission read:project --projects <project-ids>
```

Copy the resulting `client_id`/`client_secret` into `VERCEL_CLIENT_ID`/`VERCEL_CLIENT_SECRET` in your local `.env` (see `.env.example`). The resulting connection is persisted in an httpOnly cookie set by this app — no external store is needed.

### Production

Register a **separate** OAuth app for the production deployment — never reuse the dev app's credentials:

```bash
vercel oauth-apps register --name "Karasu Lab Admin" --slug karasu-lab-admin \
  --redirect-uri "https://admin.karasu256.com/api/auth/callback/vercel" --format json
vercel oauth-apps install --client-id <id> --permission read:project --projects <project-ids>
```

Then, in the production deployment's environment variables:

- Set `VERCEL_CLIENT_ID`/`VERCEL_CLIENT_SECRET` to the production app's credentials.
- Scope `vercel oauth-apps install`'s `--projects`/`--permission` to only what the dashboard needs (`read:project` is sufficient for listing deployments).

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
