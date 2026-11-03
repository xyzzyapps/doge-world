import fs from 'fs';
import path from 'path';

// Generate 48kHz Stereo 16-bit WAV of pleasant Ghibli meadow wind
const SAMPLE_RATE = 48000;
const DURATION_SEC = 20;
const NUM_SAMPLES = SAMPLE_RATE * DURATION_SEC;
const NUM_CHANNELS = 2;

console.log(`Synthesizing ${DURATION_SEC}s of pleasant Ghibli meadow wind at ${SAMPLE_RATE}Hz stereo...`);

// State for biquad IIR filters
function createBiquad() {
  return {
    x1: 0, x2: 0, y1: 0, y2: 0,
    b0: 1, b1: 0, b2: 0, a1: 0, a2: 0,
    setLowpass(freq, q) {
      const omega = 2 * Math.PI * freq / SAMPLE_RATE;
      const alpha = Math.sin(omega) / (2 * q);
      const cosw = Math.cos(omega);
      const a0 = 1 + alpha;
      this.b0 = ((1 - cosw) / 2) / a0;
      this.b1 = (1 - cosw) / a0;
      this.b2 = ((1 - cosw) / 2) / a0;
      this.a1 = (-2 * cosw) / a0;
      this.a2 = (1 - alpha) / a0;
    },
    setBandpass(freq, q) {
      const omega = 2 * Math.PI * freq / SAMPLE_RATE;
      const alpha = Math.sin(omega) / (2 * q);
      const cosw = Math.cos(omega);
      const a0 = 1 + alpha;
      this.b0 = alpha / a0;
      this.b1 = 0;
      this.b2 = -alpha / a0;
      this.a1 = (-2 * cosw) / a0;
      this.a2 = (1 - alpha) / a0;
    },
    process(input) {
      const out = this.b0 * input + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
      this.x2 = this.x1;
      this.x1 = input;
      this.y2 = this.y1;
      this.y1 = out;
      return out;
    }
  };
}

// Lowpass filter for deep air rumble
const lpLeft = createBiquad();
const lpRight = createBiquad();
lpLeft.setLowpass(180, 0.707);
lpRight.setLowpass(180, 0.707);

// Gust bandpass filters
const bpLeft1 = createBiquad();
const bpRight1 = createBiquad();
const bpLeft2 = createBiquad();
const bpRight2 = createBiquad();

// Grass rustle filters
const grassLpL = createBiquad();
const grassLpR = createBiquad();
grassLpL.setBandpass(3200, 2.0);
grassLpR.setBandpass(3500, 2.0);

// Random noise generator (Pink / Brown noise approximation)
let b0_L = 0, b1_L = 0, b2_L = 0, b3_L = 0, b4_L = 0, b5_L = 0, b6_L = 0;
let b0_R = 0, b1_R = 0, b2_R = 0, b3_R = 0, b4_R = 0, b5_R = 0, b6_R = 0;

function getPinkNoiseL() {
  const white = Math.random() * 2 - 1;
  b0_L = 0.99886 * b0_L + white * 0.0555179;
  b1_L = 0.99332 * b1_L + white * 0.0750759;
  b2_L = 0.96900 * b2_L + white * 0.1538520;
  b3_L = 0.86650 * b3_L + white * 0.3104856;
  b4_L = 0.55000 * b4_L + white * 0.5329522;
  b5_L = -0.7616 * b5_L - white * 0.0168980;
  const pink = (b0_L + b1_L + b2_L + b3_L + b4_L + b5_L + b6_L + white * 0.5362) * 0.11;
  b6_L = white * 0.115926;
  return pink;
}

function getPinkNoiseR() {
  const white = Math.random() * 2 - 1;
  b0_R = 0.99886 * b0_R + white * 0.0555179;
  b1_R = 0.99332 * b1_R + white * 0.0750759;
  b2_R = 0.96900 * b2_R + white * 0.1538520;
  b3_R = 0.86650 * b3_R + white * 0.3104856;
  b4_R = 0.55000 * b4_R + white * 0.5329522;
  b5_R = -0.7616 * b5_R - white * 0.0168980;
  const pink = (b0_R + b1_R + b2_R + b3_R + b4_R + b5_R + b6_R + white * 0.5362) * 0.11;
  b6_R = white * 0.115926;
  return pink;
}

// Gentle bird chirp generator (pastoral Ghibli motif)
function getBirdChirp(time, startTime, basePitch) {
  const tRel = time - startTime;
  if (tRel < 0 || tRel > 0.28) return 0;
  const env = Math.sin((tRel / 0.28) * Math.PI);
  const freq = basePitch + Math.sin(tRel * 45) * 450 + Math.exp(-tRel * 12) * 600;
  return Math.sin(2 * Math.PI * freq * tRel) * env * 0.12;
}

const leftChannel = new Float32Array(NUM_SAMPLES);
const rightChannel = new Float32Array(NUM_SAMPLES);

for (let i = 0; i < NUM_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;

  // Modulating wind speeds and gust envelopes
  // Primary slow swelling gust (period ~7.5s)
  const swell1 = (Math.sin(t * 0.85) * 0.5 + 0.5) * (Math.sin(t * 0.35 + 1.2) * 0.3 + 0.7);
  // Secondary cross-breeze (period ~4.2s)
  const swell2 = (Math.cos(t * 1.5 + 0.4) * 0.5 + 0.5) * 0.6;
  const totalGust = (swell1 * 0.7 + swell2 * 0.3);

  // Update dynamic filter frequencies every 64 samples
  if ((i & 63) === 0) {
    const f1L = 260 + swell1 * 280;
    const f1R = 290 + swell1 * 260;
    bpLeft1.setBandpass(f1L, 1.6);
    bpRight1.setBandpass(f1R, 1.6);

    const f2L = 550 + swell2 * 450;
    const f2R = 580 + swell2 * 420;
    bpLeft2.setBandpass(f2L, 2.2);
    bpRight2.setBandpass(f2R, 2.2);
  }

  const pinkL = getPinkNoiseL();
  const pinkR = getPinkNoiseR();
  const whiteL = Math.random() * 2 - 1;
  const whiteR = Math.random() * 2 - 1;

  // 1. Deep gentle atmospheric air
  const deepL = lpLeft.process(pinkL) * 0.45;
  const deepR = lpRight.process(pinkR) * 0.45;

  // 2. Gusts of wind through the open sky
  const gust1L = bpLeft1.process(pinkL) * (0.35 + totalGust * 0.65);
  const gust1R = bpRight1.process(pinkR) * (0.35 + totalGust * 0.65);
  const gust2L = bpLeft2.process(pinkL) * (0.15 + totalGust * 0.45);
  const gust2R = bpRight2.process(pinkR) * (0.15 + totalGust * 0.45);

  // 3. Delicate grass rustle texture
  const grassL = grassLpL.process(whiteL) * (0.04 + totalGust * 0.12);
  const grassR = grassLpR.process(whiteR) * (0.04 + totalGust * 0.12);

  // 4. Subtle pastoral meadow bird chirps
  const bird1 = getBirdChirp(t, 2.8, 3100) + getBirdChirp(t, 3.15, 3600);
  const bird2 = getBirdChirp(t, 8.4, 2900) + getBirdChirp(t, 8.72, 3400);
  const bird3 = getBirdChirp(t, 14.2, 3200) + getBirdChirp(t, 14.55, 3750);
  const birdTotal = bird1 + bird2 + bird3;

  leftChannel[i] = (deepL + gust1L + gust2L + grassL + birdTotal * 0.85) * 0.88;
  rightChannel[i] = (deepR + gust1R + gust2R + grassR + birdTotal * 0.6) * 0.88;
}

// Convert to 16-bit PCM WAV
const byteRate = SAMPLE_RATE * NUM_CHANNELS * 2;
const blockAlign = NUM_CHANNELS * 2;
const dataSize = NUM_SAMPLES * blockAlign;
const buffer = Buffer.alloc(44 + dataSize);

// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);

// fmt chunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // subchunk1 size
buffer.writeUInt16LE(1, 20);  // PCM format
buffer.writeUInt16LE(NUM_CHANNELS, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(byteRate, 28);
buffer.writeUInt16LE(blockAlign, 32);
buffer.writeUInt16LE(16, 34); // bits per sample

// data chunk
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

let offset = 44;
for (let i = 0; i < NUM_SAMPLES; i++) {
  // Clamp and write 16-bit signed integer
  let l = Math.max(-1, Math.min(1, leftChannel[i]));
  let r = Math.max(-1, Math.min(1, rightChannel[i]));
  const intL = l < 0 ? l * 32768 : l * 32767;
  const intR = r < 0 ? r * 32768 : r * 32767;
  buffer.writeInt16LE(Math.round(intL), offset);
  buffer.writeInt16LE(Math.round(intR), offset + 2);
  offset += 4;
}

const outPublic = path.resolve('public', 'audio', 'pleasant_wind.wav');
const outDist = path.resolve('dist', 'pleasant_wind.wav');
fs.writeFileSync(outPublic, buffer);
if (fs.existsSync('dist')) {
  fs.writeFileSync(outDist, buffer);
}

console.log(`Audio successfully written (${(buffer.length / 1024 / 1024).toFixed(2)} MB) to:`);
console.log(' -', outPublic);
console.log(' -', outDist);
