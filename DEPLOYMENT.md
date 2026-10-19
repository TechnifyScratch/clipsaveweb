# Private access and deployment

## Set your password privately

Run this **yourself** in the VS Code terminal, from this project folder:

```sh
npm run password:setup
```

Type a unique passphrase of at least 20 characters, then confirm it. Input stays hidden. The script writes a salted scrypt hash to `APP_PASSWORD_HASH` and a random signing secret to `SESSION_SECRET` in `.env.local`, with owner-only file permissions. It never prints your password, hash, or signing secret. Neither the password nor `.env.local` belongs in GitHub or this chat.

For a cloud deployment, open `.env.local` privately in your editor and paste **APP_PASSWORD_HASH** and **SESSION_SECRET** into the host's environment-variable settings yourself. On Vercel, select **Secret**, not Config. Do not prefix either name with `NEXT_PUBLIC_`. Do not use `vercel env pull` or paste secrets into a chat. Redeploy after changing environment variables. The plaintext password is never stored; the server compares your entered password with the hash.

The site redirects unauthenticated visitors to `/login`. Every download API also checks the session on the server. Missing/invalid environment configuration locks the app instead of disabling protection. Sessions use signed, eight-hour, HTTP-only, SameSite=Strict cookies; HTTPS uses a Secure `__Host-` cookie. Sign out using the header icon. Changing either credential invalidates existing sessions. Login has per-instance throttling; it is not a distributed rate limiter, so use a strong unique password.

## Important hosting distinction

The original macOS app launches yt-dlp and FFmpeg as child processes, keeps jobs in memory, and writes finished files to disk. A browser cannot do this YouTube workflow on its own. The downloading computer must be running somewhere, even when your personal Mac is off.

- **Vercel:** the Next.js interface and password gate build and deploy normally. The actual downloader is deliberately disabled on Vercel and shows a clear processing-configuration message. A Vercel-only deployment is **not** a working YouTube downloader. Function lifetimes and payload limits, including the 4.5 MB response-body limit, do not match this app's large-file, long-running processing architecture. See [Vercel function limits](https://vercel.com/docs/functions/limitations).
- **Supabase:** optional authentication/storage/database services would not replace the video-processing machine. Its hosted Edge Functions document a 2-second CPU limit, 256 MB memory, and 150-second free-tier wall-clock lifetime. See [Supabase function limits](https://supabase.com/docs/guides/functions/limits). This app needs no database for its single-password setup.
- **GitHub Actions:** use it for CI, not as the application's production download engine. Its terms limit use as a serverless application/content delivery service. See [GitHub additional product terms](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#actions).
- **Free container hosting:** the included Dockerfile and optional Render blueprint can run the complete app while your Mac is off. No paid hosting resources are created by this repository. This route still uses a backend, but can operate within a host's free allowance.

## Optional complete app on Render's free tier

1. Sign in to Render and create a Blueprint from `TechnifyScratch/clipsaveweb`, or create a **Docker web service** from that repo.
2. Confirm the instance is **Free**. The included `render.yaml` explicitly selects `plan: free`; do not select an upgrade or attach a paid database/disk.
3. Add `APP_PASSWORD_HASH` and `SESSION_SECRET` privately as described above.
4. Deploy. Use the provided HTTPS `.onrender.com` address from any computer and sign in.
5. Paste a permitted YouTube URL, choose quality, download, then click **Save MP4** to save the finished file to the computer you are using.

Render's supplied `RENDER_EXTERNAL_URL` is used to validate same-origin requests. For a custom domain, set `APP_ORIGIN=https://your-domain.example` to the exact origin. The app must run as **one instance** because jobs are in memory. Use the Docker image so yt-dlp, FFmpeg, ffprobe and a Node JavaScript runtime are available.

Finished hosted downloads expire after one hour, and all jobs/files may disappear on sleep, restart or redeploy. Save your MP4 promptly. No durable database or disk is needed. On your Mac, ordinary `~/Downloads` files remain untouched by hosted-file expiry; expiry is enabled only with `EPHEMERAL_DOWNLOADS=true`.

Free hosting has limits: Render spins down idle services after 15 minutes, waking can take about a minute, and shared CPU can make conversion slow. Included hours, bandwidth and service-initiated traffic limits apply. A video-heavy app may exhaust free limits, and YouTube can restrict datacenter IPs even for public videos. Do not assume unlimited or guaranteed downloads. To avoid charges, stay on Free, avoid adding a payment method, and review your account's spending controls. See [Render free service limitations](https://render.com/docs/free). No cloud download has been verified until you actually deploy and test your service.

## Vercel deployment (password-protected interface only)

1. Import `TechnifyScratch/clipsaveweb` into Vercel.
2. Select Next.js; use the default npm install and `npm run build`.
3. Add `APP_PASSWORD_HASH` and `SESSION_SECRET` as **Secret** environment variables for Production and any Preview deployments you use.
4. If using a custom domain, optionally pin `APP_ORIGIN` to its exact HTTPS origin.
5. Deploy and sign in using your password. It stays inaccessible until the environment is configured. The interface explains that video processing needs a suitable Node host.

There is no hidden paid processor or public proxy configured. Connecting Vercel to a separate processor would require additional integration; deploying the full app directly on Render avoids that extra layer.

## Local use

```sh
npm run password:setup
npm run launch
```

The macOS launcher still requires Node 22+, yt-dlp and FFmpeg. Browser **Save MP4** works locally as well as on a compatible hosted deployment. Open File/Show in Finder remain available only in local macOS mode.

## Verification

```sh
npm test
npm run build
```

Auth tests use random ephemeral credentials, never real environment files. They cover invalid passwords, session tampering/expiry/rotation, missing configuration, page/API protection, cross-origin login/logout, cookie flags and throttling. The Docker configuration requires a real deployment or local Docker installation for container verification. Never test by committing credentials.
