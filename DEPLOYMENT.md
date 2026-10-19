# Deployment

ClipSave has no password, login screen, or session-cookie requirement. Anyone who can reach a hosted deployment can use it. Old `APP_PASSWORD_HASH` and `SESSION_SECRET` environment variables are unused and can be removed from your host settings; no environment files need to be opened or changed for local use.

## Local macOS use

```sh
npm run launch
```

Open http://localhost:3000 directly. The launcher requires Node 22+, yt-dlp and FFmpeg. Finished files save to `~/Downloads`. Browser Save MP4, Open File and Show in Finder are available.

## Complete app on Render's free tier

The included Dockerfile runs yt-dlp and FFmpeg on a hosted computer, so your personal Mac can be off.

1. Create a Render Blueprint from `TechnifyScratch/clipsaveweb`, or create a Docker web service from that repo.
2. Select **Free**; the included `render.yaml` explicitly uses `plan: free`. No database or paid disk is needed.
3. Deploy and open the supplied HTTPS `.onrender.com` address. No password variables are required.
4. Download a permitted video, then click **Save MP4** to save it to the computer you are using.

The supplied `RENDER_EXTERNAL_URL` is used for origin checks. For a custom domain, set `APP_ORIGIN` to its exact HTTPS origin. Run one instance: jobs live in memory. Hosted files expire after one hour with `EPHEMERAL_DOWNLOADS=true`, and may disappear on restart, redeploy or sleep. Local Downloads files do not use this expiry by default.

Free hosting has limits: idle services sleep after 15 minutes, waking can take about a minute, and video conversion can be slow. Hours, bandwidth and service-initiated traffic limits apply. YouTube can block datacenter IPs. Free hosting does not guarantee unlimited downloads. Stay on Free and review account spending controls to avoid charges. See [Render free-tier limits](https://render.com/docs/free). The container/cloud download flow has not been verified on a deployed Render service.

## Vercel: interface only

Import the repo, select Next.js, and use `npm run build`. No password variables are needed. The interface deploys, but downloading is deliberately disabled and displays an explanation. This is **not** a complete Vercel-hosted downloader: its functions do not match this app's long-running child processes, in-memory jobs and large video responses. See [Vercel function limits](https://vercel.com/docs/functions/limitations).

Supabase can provide auth/storage/database services but its hosted functions do not replace the yt-dlp/FFmpeg processing machine. See [Supabase limits](https://supabase.com/docs/guides/functions/limits). GitHub Actions is for CI rather than hosting this application's production download engine.

## Checks

```sh
npm test
npm run build
```

Environment files remain excluded from Git. Origin/host checks remain enabled even though the password gate has been removed.
