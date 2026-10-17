import { stat } from 'node:fs/promises';
import path from 'node:path';
import { run } from './process.js';
import { requireValue } from './errors.js';

export const ffmpeg = () => process.env.ANIMLANG_FFMPEG ?? 'ffmpeg';
export const ffprobe = () => process.env.ANIMLANG_FFPROBE ?? 'ffprobe';
export const frameName = index => `frame-${String(index).padStart(6, '0')}.png`;

export async function probeVideo(file) {
  const { stdout } = await run(ffprobe(), ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,nb_frames,duration:format=duration', '-of', 'json', file]);
  const info = JSON.parse(stdout);
  const stream = info.streams?.[0];
  const duration = Number(stream?.duration ?? info.format?.duration);
  const [n, d] = (stream?.r_frame_rate ?? '0/1').split('/').map(Number);
  requireValue(stream && Number.isFinite(duration) && duration > 0, 'INVALID_VIDEO', 'The renderer did not produce a video with a positive duration.');
  return { width: stream.width, height: stream.height, fps: n / d, duration,
    frames: stream.nb_frames && stream.nb_frames !== 'N/A' ? Number(stream.nb_frames) : undefined };
}

export async function encodeFrames(directory, fps, frames, file) {
  await run(ffmpeg(), ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
    '-framerate', String(fps), '-start_number', '0', '-i', path.join(directory, 'frame-%06d.png'),
    '-frames:v', String(frames), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file]);
}

export async function extractFrame(video, time, file) {
  await run(ffmpeg(), ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
    '-i', video, '-ss', String(time), '-frames:v', '1', '-threads', '1', file]);
  requireValue((await stat(file).catch(() => null))?.size > 0, 'FRAME_MISSING', `FFmpeg did not produce a frame at ${time} seconds.`);
}

export async function clipVideo(video, range, fps, file) {
  await run(ffmpeg(), ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
    '-i', video, '-ss', String(range.from), '-t', String(range.to - range.from),
    '-map', '0:v:0', '-map', '0:a?', '-r', String(fps), '-c:v', 'libx264', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', file]);
}
