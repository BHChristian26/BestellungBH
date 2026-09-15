# BestellungBH – hosted iPhone version

This package protects the existing BestellungBH Gastronovi/Lager/Lieferanten app behind a server-side login.

## Required environment variables

Set:
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `PORT` (optional; hosting platforms usually set this automatically)

Do not put real credentials in the HTML.

## Run locally

```bash
ADMIN_USER=admin ADMIN_PASSWORD='choose-a-strong-password' npm start
```
Then open `http://localhost:3000`.

## Deploy

This is a Node.js web service. On a host such as Render, Railway, Fly.io, or another Node host:
- Build command: none
- Start command: `npm start`
- Environment variables: `ADMIN_USER`, `ADMIN_PASSWORD`

Use HTTPS on the host. Then open the resulting `https://...` address in Safari and use **Share → Add to Home Screen**.

## Important

The Gastronovi `.xlsx` upload is handled inside the app in the browser, so the sales file does not have to be uploaded to a third-party service by this server.
