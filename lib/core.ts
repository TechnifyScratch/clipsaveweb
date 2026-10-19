export function youtubeUrl(input: unknown): string {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('Paste a valid YouTube video link.');
  let u: URL;
  try { u = new URL(input.trim()); } catch { throw new Error('Paste a complete YouTube link, including https://.'); }
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.port) throw new Error('Use a standard YouTube video link.');
  const host = u.hostname.toLowerCase();
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else id = u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)\/?$/)?.[1] ?? null;
  }
  if (!id || !/^[\w-]{11}$/.test(id)) throw new Error('That link does not identify a supported YouTube video.');
  return `https://www.youtube.com/watch?v=${id}`;
}
export type Format = {height?: number; vcodec?: string; acodec?: string; has_drm?: boolean};
export function qualityOptions(formats: Format[]) {
  const heights = new Set(formats.filter(f => f.vcodec && f.vcodec !== 'none' && !f.has_drm).map(f => f.height));
  return [360,480,720,1080].filter(h => heights.has(h));
}
export function safeName(title: string) {
  return title.normalize('NFKC').replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, '').replace(/^\.+/, '').trim().slice(0, 120) || 'YouTube video';
}
export function friendlyError(raw: string) {
  if (/ENOSPC|no space left/i.test(raw)) return 'Your disk is full. Free up space in Downloads and try again.';
  if (/ENOENT|not found/i.test(raw)) return 'A required tool is missing. Run the startup script to check your installation.';
  if (/private|members.only|sign in|age.restrict|confirm your age|bot/i.test(raw)) return 'YouTube restricted access to this video. Choose a public video that does not require signing in.';
  if (/unavailable|removed|copyright|not available/i.test(raw)) return 'This video is unavailable. Try another public video.';
  if (/network|timed out|timeout|resolve|connection|HTTP Error [45]/i.test(raw)) return 'The connection to YouTube failed. Check your network, update yt-dlp, and try again.';
  if (/format|codec|conversion|ffmpeg/i.test(raw)) return 'The video could not be processed into MP4. Update yt-dlp and FFmpeg, or try a different quality.';
  return 'This video could not be downloaded. Try again, or update yt-dlp and choose another video.';
}
export function parseProgress(line: string) {
  if (!line.startsWith('CLIP_PROGRESS:')) return null;
  try {
    const p = JSON.parse(line.slice(14));
    const total = Number(p.total_bytes || p.total_bytes_estimate);
    return { percent: total > 0 ? Math.min(100, Number(p.downloaded_bytes || 0) / total * 100) : null, speed: typeof p.speed === 'number' ? p.speed : null, eta: typeof p.eta === 'number' ? p.eta : null };
  } catch { return null; }
}
