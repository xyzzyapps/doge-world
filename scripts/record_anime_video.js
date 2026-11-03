import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FFMPEG_PATH = 'C:\\Users\\manic\\Documents\\dev-apps\\ffmpeg\\bin\\ffmpeg.exe';

async function record() {
  console.log('Launching Chrome for 1080p video recording...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-webgl',
      '--enable-unsafe-webgl',
      '--window-size=1920,1080',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  console.log('Opening page http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // Wait 3.5 seconds for Doge model, grass shaders, and scene to fully initialize
  console.log('Waiting for scene and Doge kinematics initialization...');
  await new Promise(r => setTimeout(r, 3500));

  console.log('Starting in-browser 1080p 60fps canvas recording (16 seconds)...');
  const base64Data = await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        return reject(new Error('Canvas element not found'));
      }

      // Check supported mime types
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const stream = canvas.captureStream(60);
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 45000000 // 45 Mbps for ultra-clean 1080p anime lines
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve({ base64, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      };

      recorder.start(100);

      // Record for 16 seconds to capture a complete sweeping circuit around the meadow
      setTimeout(() => {
        recorder.stop();
      }, 16000);
    });
  });

  console.log('Recording finished! Converting to file...');
  const rawWebmPath = path.resolve('dist', 'anime_doge_raw_1080p.webm');
  const buffer = Buffer.from(base64Data.base64, 'base64');
  fs.writeFileSync(rawWebmPath, buffer);
  console.log(`Raw 1080p WebM saved (${(buffer.length / 1024 / 1024).toFixed(2)} MB) to: ${rawWebmPath}`);

  await browser.close();

  // Convert WebM to MP4 and mux with pleasant meadow wind audio using FFmpeg
  const audioPath = path.resolve('public', 'audio', 'pleasant_wind.wav');
  const outputMp4Path = path.resolve('dist', 'anime_cel_sketch_doge_1080p.mp4');
  console.log('Encoding 1080p MP4 with pleasant wind audio via FFmpeg...');
  const ffmpegCmd = `"${FFMPEG_PATH}" -y -i "${rawWebmPath}" -i "${audioPath}" -c:v libx264 -preset slow -crf 14 -b:v 30M -maxrate 45M -bufsize 60M -pix_fmt yuv420p -c:a aac -b:a 256k -shortest "${outputMp4Path}"`;
  execSync(ffmpegCmd, { stdio: 'inherit' });

  // Copy to Brain Artifacts directory
  const artifactDir = 'C:\\Users\\manic\\.gemini\\antigravity-cli\\brain\\cd088307-b86b-47b2-b13e-7bfdadedfa43';
  const artifactMp4Path = path.join(artifactDir, 'anime_cel_sketch_doge_1080p.mp4');
  fs.copyFileSync(outputMp4Path, artifactMp4Path);
  console.log(`Copied 1080p MP4 to Artifacts: ${artifactMp4Path}`);

  // Also update standard name
  const standardArtifactPath = path.join(artifactDir, 'anime_cel_sketch_doge.mp4');
  fs.copyFileSync(outputMp4Path, standardArtifactPath);

  console.log(`SUCCESS! High-definition 1080p MP4 generated at: ${outputMp4Path}`);
}

record().catch(err => {
  console.error('Recording error:', err);
  process.exit(1);
});
