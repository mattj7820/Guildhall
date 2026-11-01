# Deploying Guildhall

How to run Guildhall on a server so a group can use it. It's written for
[Dokploy](https://dokploy.com) (Docker with Traefik in front for HTTPS), but any Docker host with
a reverse proxy works the same way.

## How it fits together

```
Obsidian ─► Google Drive ─► vault-sync (rclone, read-only, every minute) ─► vault volume
                                                                               │ read-only
Browser ─► https://<domain> ─► Traefik (HTTPS) ─► app (Guildhall) ─────────────┘
                                                     └─► data volume (members, maps, encounters, characters)
```

- **`app`** is the image built from the `Dockerfile`: Node 26, production packages only, running
  as an unprivileged user, with the vault at `/vault` (mounted read-only) and Guildhall's own
  data at `/data`.
- **`vault-sync`** is the stock `rclone/rclone` image. It mirrors one Google Drive folder into
  the vault volume every minute, using a Google service account that can only read that folder.
  Edits reach Guildhall about a minute after Drive has them. It never deletes more than 50 files
  in one sync, so a mis-shared or emptied folder can't wipe the copy.
- **Data** lives in the `data` named volume and survives redeploys. Dokploy backs it up every
  night to a bucket off the server (see [Backups](#backups)).

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
- **Live updates** (tokens, fog reveals) use a websocket at `/live` on the same address. Traefik
  passes websockets through with nothing to configure, and so does Dokploy's domain setup. After
  deploying, open a shared map: the top right says **Live**. If it keeps saying
  "Reconnecting…", something in front of Guildhall is dropping websockets; maps still work, but
  changes take a few seconds (they're checked by polling instead). The server pings every
  connection every 25 seconds, so idle timeouts in a proxy don't close them. A redeploy closes
  them all; browsers reconnect by themselves.

## Backups

The data volume is everything Guildhall knows that the vault doesn't: members, maps, fog,
tokens, fights and character sheets. The first campaign's files are at the top of it; each later
campaign's are in `campaigns/<id>/`. The vault itself is safe in Google Drive. The data is backed
up with a Dokploy **Volume Backup** to an S3-compatible bucket in an account the DM owns (we use
Cloudflare R2's free tier), so a lost or rebuilt server doesn't lose the campaign.

### Setting it up

1. Make a **private** bucket, and a key that can only read and write that bucket. On Cloudflare
   R2: an Account API token with Object Read & Write, limited to the bucket. Dokploy uses its
   Access Key ID, Secret Access Key and S3 endpoint, not the token value.
2. In Dokploy, add the bucket under **S3 Destinations** (region `auto` for R2), and test it.
3. On the compose service's **Volume Backups**, back up service `app`'s volume ending in `_data`
   (not `_vault`) nightly, keeping the latest 14. Leave **Turn Off Container During Backup** off:
   every file is written whole and renamed into place, so a copy taken while the app runs is
   never half-written.
4. Run it once, download the `.tar` and check the JSON files are inside.

Each backup is a tar of the volume, with the JSON files at the top and the `cache` folder
(most of its size; it could be left out, but it's small enough not to bother).

### Restoring

1. Stop `app` in Dokploy, so nothing writes while the files are replaced.
2. On the server, unpack the backup into the volume (the volume's full name is in
   `docker volume ls`):

   ```sh
   docker run --rm -v <project>_data:/data -v "$PWD":/backup alpine \
     sh -c 'rm -rf /data/* && tar -xf /backup/<backup>.tar -C /data'
   ```

3. Start `app` again. Anything changed since the backup is lost, so restore from just before
   whatever went wrong.

Before a deploy that changes how data is stored, run the backup by hand first: rolling back an
image after new data is written can lose the new fields (older code drops what it doesn't know).

## Security notes

- Everything that players are allowed to see is reachable over the internet, behind a Discord
  sign-in and the DM's approval.
- The server's administrator can read the vault copy, the data volume and the environment
  (including secrets). Only host it where you trust the administrator.
- The app mounts the vault read-only; the only place it writes is `/data`. Its `cache` folder
  holds generated files (the tiles of players' maps): deleting it only means they're made again.
- Backups hold the same data as the volume (including members' Discord IDs), so the bucket is
  private and its key can reach nothing else.
- `app` is only exposed to Traefik's network (`expose`, not `ports`), so it can't be reached
  over plain HTTP on the server's public address.
