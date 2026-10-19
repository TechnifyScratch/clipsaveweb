import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { api } from '@/lib/http';
import { getJob } from '@/lib/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(req, async () => {
    const job = getJob((await params).id);
    if (!job || job.status !== 'complete' || !job.file || !job.filename) return Response.json({ error: 'This download is no longer available.' }, { status: 404 });
    let size: number;
    try { size = (await stat(job.file)).size; } catch { return Response.json({ error: 'This file has expired or was moved.' }, { status: 404 }); }
    const stream = createReadStream(job.file);
    const abort = () => stream.destroy();
    req.signal.addEventListener('abort', abort, { once: true });
    stream.once('close', () => req.signal.removeEventListener('abort', abort));
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(size),
      'Content-Disposition': `attachment; filename="video.mp4"; filename*=UTF-8''${encodeURIComponent(job.filename).replace(/['()*]/g, c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  });
}
