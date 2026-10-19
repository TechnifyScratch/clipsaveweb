# Verification — October 15, 2026

Environment: macOS Darwin 25, Apple Silicon, Node 22.20.0. Next.js 16.4.1 with Webpack. Production compilation and TypeScript checks passed. The dependency installation reported zero known vulnerabilities.

## Observed integration checks

- Real metadata extraction and browser preview: Blender's **Big Buck Bunny 60fps 4K — Official Blender Foundation Short Film**, https://www.youtube.com/watch?v=aqz-KE-bpKQ. Blender's openly licensed test film was used for the authorized download test. Returned duration 635 seconds; 360, 480, 720 and 1080p options; thumbnail, title and audio availability.
- Real browser workflow: selected 360p with Canvas-friendly enabled, downloaded video and audio, processed locally, and received the success state.
- Actual saved file: `~/Downloads/Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film.mp4`, **29,096,570 bytes**. ffprobe confirmed **H.264, 640×360, yuv420p, AAC**, duration 634.62458 seconds, MP4 container. The authorized test file is left in Downloads for inspection.
- Progress: live SSE delivered download percentages from 0 through 9.65% during the cancellation test; browser observed processing progress and completion on the completed job.
- Cancellation: started a second real 1080p download, cancelled after three seconds; API and SSE both reported `cancelled`. No hidden staging folders remained after cleanup. Process groups are terminated so yt-dlp's merge subprocesses are included.
- macOS file actions: Show in Finder and Open File both returned success from `/usr/bin/open`. Finder opened its Downloads window; precise selection was not confirmed by the automation snapshot. Playback correctness was checked structurally with ffprobe, not by watching the complete film.
- API rejects a hostile Origin with HTTP 403 and a YouTube lookalike domain with HTTP 400 and friendly messages.
- UI visually inspected at a narrow viewport, including empty/setup, metadata and successful download states. `preview.jpg` captures the completed page. Browser extensions added attributes to HTML/body in development and caused an extension-related hydration warning; the source uses deterministic rendering.

## Automated checks

`npm test` runs ten core checks and skips the optional real-media integration test unless enabled. With yt-dlp, ffmpeg and ffprobe on PATH:

```sh
CLIPSAVE_MEDIA_TESTS=1 npm test
```

All **11 tests passed**, including generation of an owned two-second VP9/Opus fixture and conversion through the application's actual conversion function into H.264/yuv420p + AAC. Core checks cover URL normalization/rejection, real resolution filtering, safe filenames, JSON progress parsing, same-origin guards, friendly errors, child-process execution, cancellation and non-overwriting atomic publication.

The macOS startup scripts passed `bash -n`; missing dependency reporting was checked. A full production build passed. Turbopack could not launch its CSS worker under this environment's restrictions, so build/development scripts explicitly use the supported Webpack alternative.

## Dependencies and limits

System-wide yt-dlp/FFmpeg were absent. Testing used isolated **temporary** tools under `/private/tmp`, including yt-dlp 2026.8.19 (with EJS), FFmpeg 9 and ffprobe 9. FFmpeg executable SHA256 values matched the distributor's published checksums. These temporary paths are not embedded in application source. For normal launches, install `brew install yt-dlp ffmpeg` as described in README.md.

The older yt-dlp test video `BaW_jenozKc` returned unavailable; the real workflow used Big Buck Bunny instead. Private/age restrictions, disk-full, conversion failures and network disconnections have friendly error mappings, but destructive disk exhaustion and deliberate live network loss were not induced. Uploading to a real Canvas course was outside scope; school-specific limits remain the user's responsibility.
