# ClipSave

A local macOS utility that turns permitted YouTube videos into MP4s for class submissions. Next.js, TypeScript, Tailwind, Lucide, yt-dlp, and FFmpeg. No accounts, database, hosted backend, or paid APIs.

## Cloud hosting

There is no password or sign-in step. See [DEPLOYMENT.md](DEPLOYMENT.md) for optional free Render hosting and the Vercel/Supabase processing limitations. Vercel hosts the interface only; it cannot run the complete downloader as currently designed.

## Install and launch

Requires macOS, Node.js **22+** with npm, and current yt-dlp + FFmpeg (including ffprobe).

1. Install Node from https://nodejs.org, or `brew install node`.
2. Install video tools: `brew install yt-dlp ffmpeg`. Install Homebrew from https://brew.sh if needed.
3. In this directory, run:

```sh
npm run launch
```

The script checks dependencies, installs npm packages on first launch, builds the production app, starts it on **127.0.0.1:3000**, and opens **http://localhost:3000** in your default browser. Keep the Terminal open; Control-C stops the server. You can also double-click **Start ClipSave.command** in Finder. If macOS blocks the script, launch it from Terminal with `bash scripts/start.sh`.

For development: `npm ci && npm run dev`. For an already-built production app: `npm start`.

## Use

Paste a YouTube watch, Shorts, embed, live-recording, or youtu.be link. Tracking/playlist parameters are discarded. Get Video retrieves the title, thumbnail, duration, and actual resolutions; choose a quality and Download MP4. The optional Canvas-friendly preset caps resolution at 1080p and uses a balanced H.264 bitrate with 128 kb/s AAC. With the preset off, compatible H.264/yuv420p and AAC streams are copied without re-encoding. Other codecs are converted locally. Every output is checked with ffprobe and uses MP4 fast-start metadata.

Downloads include audio whenever an accessible audio stream exists. Video-only sources are identified in the preview. The progress bar describes the current video/audio transfer, then processing; it can restart when yt-dlp moves to the next stream. Unknown percentages are indeterminate. Cancel terminates the active process and removes temporary files. Completed MP4s are saved to **~/Downloads**; existing filenames receive ` (1)`, ` (2)`, etc. Open File uses your default player; Show in Finder reveals the completed file. Job state survives browser refresh while the server remains running.

Use only videos you own or have permission to download. ClipSave does not use account cookies, unlock private videos, bypass DRM or access restrictions, or support live broadcasts. YouTube/network restrictions can still make public videos unavailable. Canvas upload limits vary by institution and course; the preset does not guarantee acceptance or a specific maximum file size.

## Local architecture and security

- Node-only API routes use `spawn(command, argumentArray)` without a shell. URLs are allowlisted and normalized to a single validated YouTube video ID.
- Host, Origin, and Fetch Metadata checks reject remote/cross-site requests. Keep the loopback binding; this is a personal local tool, not a multi-user server.
- No client-supplied output paths, commands, cookies, filenames, or format expressions are accepted. Finder actions accept only a server-generated completed job ID.
- Staging occurs in a private, randomly named `~/Downloads/.clipsave-*` folder. Only verified outputs are published with an atomic, no-overwrite hard link. Stage folders are removed on completion, error, or cancellation.
- One job runs at a time. Jobs live in memory and expire after 24 hours as new jobs start. Restarting the server loses job history, but keeps completed files. Stop/cancel before quitting. A forced process termination or power loss may leave a hidden `.clipsave-*` folder, which can be removed after ClipSave is stopped.
- The UI requests YouTube thumbnails directly; yt-dlp contacts YouTube and its media servers. No video is uploaded to ClipSave servers.

## API

| Route | Purpose |
| --- | --- |
| GET /api/health | Check yt-dlp, FFmpeg and ffprobe |
| POST /api/metadata | JSON `{ "url": "…" }` |
| POST /api/jobs | JSON `{ "url": "…", "quality": 720, "canvas": true }`; quality can be `"best"` |
| GET /api/jobs/:id | Current status and completed filename/size |
| GET /api/jobs/:id/events | Server-sent progress events |
| POST /api/jobs/:id/cancel | Stop and clean up a job |
| POST /api/jobs/:id/open | JSON `{ "action": "open" }` or `"reveal"` |

## Checks and troubleshooting

```sh
npm test
npm run build
```

Tests cover supported/malicious URLs, resolution filtering, safe filenames, progress parsing, local-request checks, friendly errors, child-process execution duplicate file publication and real child-process cancellation. The optional `CLIPSAVE_MEDIA_TESTS=1 npm test` also exercises actual VP9/Opus conversion through FFmpeg. See **QA.md** for observed integration results and limitations.

- **Missing tools:** `brew install yt-dlp ffmpeg`; restart the app. The launcher includes both Apple Silicon and Intel Homebrew paths.
- **YouTube errors:** `brew update && brew upgrade yt-dlp ffmpeg`. ClipSave enables yt-dlp's Node JavaScript runtime. Keep yt-dlp current as YouTube changes.
- **Private/age restricted/sign-in requests:** choose an unrestricted video. ClipSave intentionally has no cookie import or login bypass.
- **Full disk:** free space for both the original streams and the finished MP4. Conversion may require roughly twice the final file size or more.
- **Conversion failure:** update FFmpeg and try a lower quality. The UI shows a friendly message instead of raw command output.
- **Port in use:** stop the other process using port 3000 and launch again.
- **Slow processing:** non-H.264 sources require CPU encoding; this can take several minutes for large videos. Disable the preset to avoid recompressing an already compatible high-bitrate source.
