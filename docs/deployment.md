# Deploying Guildhall

How to run Guildhall on a server so a group can use it. It's written for
[Dokploy](https://dokploy.com) (Docker with Traefik in front for HTTPS), but any Docker host with
a reverse proxy works the same way.

## How it fits together

```
Obsidian ─► Google Drive ─► vault-sync (rclone, read-only, every minute) ─► vault volume
                                                                               │ read-only
Browser ─► https://<domain> ─► Traefik (HTTPS) ─► app (Guildhall) ─────────────┘
                                                     └─► data volume (members, maps, encounters)
```

- **`app`** is the image built from the `Dockerfile`: Node 26, production packages only, running
  as an unprivileged user, with the vault at `/vault` (mounted read-only) and Guildhall's own
  data at `/data`.
- **`vault-sync`** is the stock `rclone/rclone` image. It mirrors one Google Drive folder into
  the vault volume every minute, using a Google service account that can only read that folder.
  Edits reach Guildhall about a minute after Drive has them. It never deletes more than 50 files
  in one sync, so a mis-shared or emptied folder can't wipe the copy.
- **Data** lives in the `data` named volume and survives redeploys. It isn't backed up yet.

Both services are defined in `docker-compose.yml`.

## One-off setup

### Discord application (sign-in)

1. Go to <https://discord.com/developers/applications> and create a **New Application**.
2. Under **OAuth2**:
   - Copy the **Client ID**, and reset and copy the **Client Secret**.
   - Add the redirect `https://<domain>/auth/discord/callback`. For testing locally, also add
     `http://localhost:3000/auth/discord/callback`.
3. Guildhall only asks for the `identify` scope: someone's Discord ID and name.
4. Find the DM's Discord user ID: in Discord's settings turn on Developer Mode, then right-click
   your name and choose **Copy User ID**.

### Google service account (reading the vault)

1. In the [Google Cloud console](https://console.cloud.google.com), create a project and enable
   the **Google Drive API**.
2. Under **IAM & Admin → Service Accounts**, create a service account with no roles, then add a
   **JSON key** and download it. The key is a secret.
3. In Google Drive, share the vault folder with the service account's email address as
   **Viewer**.
4. The folder's ID is the last part of its address: `drive.google.com/drive/folders/<ID>`.

### Domain

Point an `A` (and, for IPv6, `AAAA`) DNS record for the domain at the server. On Cloudflare,
leave it "DNS only", so Traefik can get a Let's Encrypt certificate itself.

## Dokploy

1. Create a **Compose** service from this repository, branch `main`, compose path
   `./docker-compose.yml`.
2. Set the environment variables below (Dokploy writes them to a `.env` file that
   `docker-compose.yml` reads).
3. Add the domain to service **`app`**, port **3000**, with HTTPS and a Let's Encrypt
   certificate.
4. Deploy. The logs show the vault being copied, then `[vault] Serving N notes`.

| Variable                      | Example                         | Notes                                                                                                                  |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_URL`                  | `https://guildhall.example.com` | Exactly the address people use; sign-in redirects are built from it.                                                   |
| `TRUST_PROXY`                 | `1`                             | Traefik is one proxy in front. Defaults to 1 in the compose file.                                                      |
| `SESSION_SECRET`              | 64 random characters            | Signs sign-in cookies. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `DISCORD_CLIENT_ID`           |                                 | From the Discord application.                                                                                          |
| `DISCORD_CLIENT_SECRET`       |                                 | From the Discord application.                                                                                          |
| `DM_DISCORD_IDS`              | `123456789012345678`            | The DM's Discord ID; comma-separate several.                                                                           |
| `ROLL20_CAMPAIGN_URL`         |                                 | Optional.                                                                                                              |
| `GDRIVE_FOLDER_ID`            |                                 | The vault folder's ID.                                                                                                 |
| `GDRIVE_SERVICE_ACCOUNT_JSON` | `{"type":"service_account",…}`  | The whole JSON key, on one line.                                                                                       |

`DEV_LOGIN` must stay off. Guildhall refuses to start with it on and a non-local `PUBLIC_URL`,
and dev sign-ins are refused from outside the container anyway.

## First sign-in

1. Open the site and choose **Sign in with Discord**. The DM goes straight in.
2. Players sign in the same way and wait on "Waiting for the DM".
3. On **Members**, the DM lets each one in and picks which player they are (the names come from
   the `player:` field of `type: pc` notes).

## Operating it

- **Updating:** redeploy (or turn on Dokploy's auto-deploy for `main`). The data volume is kept.
- **Rotating the session secret:** put the new secret first in `SESSION_SECRET`, followed by a
  comma and the old one, and redeploy. Existing sign-ins keep working and are re-signed with the
  new secret. Drop the old secret later.
- **Signing someone out everywhere:** remove them on the Members page. If they sign in again,
  they wait to be let in again.
- **Health:** `GET /healthz` answers `{"status":"ok"}`. The image's `HEALTHCHECK` uses it.
- **Logs:** `app` logs requests and vault reloads; `vault-sync` logs each file it copies or
  deletes.

## Security notes

- Everything that players are allowed to see is reachable over the internet, behind a Discord
  sign-in and the DM's approval.
- The server's administrator can read the vault copy, the data volume and the environment
  (including secrets). Only host it where you trust the administrator.
- The app mounts the vault read-only; the only place it writes is `/data`.
- `app` is only exposed to Traefik's network (`expose`, not `ports`), so it can't be reached
  over plain HTTP on the server's public address.
