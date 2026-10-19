import { randomBytes, scryptSync } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';

if (!process.stdin.isTTY) { console.error('Run this yourself in an interactive terminal. Your password will stay hidden.'); process.exit(1); }
function hidden(prompt) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    const input = process.stdin;
    let value = '';
    input.setRawMode(true); input.resume(); input.setEncoding('utf8');
    function done() { input.removeListener('data', onData); input.setRawMode(false); input.pause(); process.stdout.write('\n'); }
    function onData(chunk) {
      for (const character of chunk) {
        if (character === '\u0003') { done(); reject(new Error('Cancelled.')); return; }
        if (character === '\r' || character === '\n') { done(); resolve(value); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    }
    input.on('data', onData);
  });
}
try {
  const password = await hidden('Choose a unique password (at least 20 characters; hidden): ');
  if (password.length < 20) throw new Error('Use at least 20 characters. A long, unique passphrase works well.');
  if (password !== await hidden('Confirm password (hidden): ')) throw new Error('Passwords did not match.');
  const filename = resolve('.env.local');
  let contents = '';
  try { contents = await readFile(filename, 'utf8'); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  const salt = randomBytes(16).toString('hex');
  const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  const values = { APP_PASSWORD_HASH: hash, SESSION_SECRET: randomBytes(32).toString('hex') };
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    contents = pattern.test(contents) ? contents.replace(pattern, `${key}=${value}`) : `${contents.trimEnd()}\n${key}=${value}\n`;
  }
  await writeFile(filename, contents.trimStart(), { mode: 0o600 }); await chmod(filename, 0o600);
  console.log('Password configured in .env.local. No password or secrets were printed.');
  console.log('For Vercel, copy APP_PASSWORD_HASH and SESSION_SECRET privately into its Environment Variables settings, then redeploy.');
} catch (err) { console.error(err.message || 'Setup failed.'); process.exitCode = 1; }
