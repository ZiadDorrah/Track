// Web Audio API Sound Synthesizer Utility
// Generates offline audio effects & ambient soundscapes without external audio files.

let audioCtx = null;
let ambientOscillators = [];
let ambientGainNode = null;
let currentAmbientType = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 🔔 Satisfying Completion Chime (Glass/Marimba 2-Tone Chime)
export function playCompletionChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Tone 2: B5 (987.77 Hz) - played 100ms later
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.1);
    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.error('Audio chime error:', err);
  }
}

// 🎧 Ambient Soundscape Synthesizers
export function stopAmbientSound() {
  ambientOscillators.forEach(node => {
    try {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    } catch (e) {}
  });
  ambientOscillators = [];
  if (ambientGainNode) {
    try { ambientGainNode.disconnect(); } catch (e) {}
    ambientGainNode = null;
  }
  currentAmbientType = null;
}

export function playAmbientSound(type, volume = 0.3) {
  stopAmbientSound();
  if (!type || type === 'none') return;

  const ctx = getAudioContext();
  if (!ctx) return;

  currentAmbientType = type;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(volume, ctx.currentTime);
  masterGain.connect(ctx.destination);
  ambientGainNode = masterGain;

  const bufferSize = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);

  if (type === 'rain' || type === 'white' || type === 'cafe') {
    // Generate pink / filtered noise
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'white') {
        output[i] = white * 0.15;
      } else {
        // Pink noise filter algorithm
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter setup
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    if (type === 'rain') {
      filter.frequency.setValueAtTime(1000, ctx.currentTime);
    } else if (type === 'cafe') {
      filter.frequency.setValueAtTime(450, ctx.currentTime);
    } else {
      filter.frequency.setValueAtTime(3000, ctx.currentTime);
    }

    whiteNoise.connect(filter);
    filter.connect(masterGain);
    whiteNoise.start();
    ambientOscillators.push(whiteNoise);

  } else if (type === 'lofi') {
    // Synthesize soothing warm chord loop (Cmaj7 / Am7 ambient swell)
    const frequencies = [261.63, 329.63, 392.00, 493.88]; // C, E, G, B
    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      // Gentle lfo modulation
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.2 + idx * 0.05, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.05, ctx.currentTime);
      lfo.connect(lfoGain.gain);

      oscGain.gain.setValueAtTime(0.08, ctx.currentTime);
      
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      
      osc.start();
      lfo.start();
      ambientOscillators.push(osc, lfo);
    });
  }
}

export function getCurrentAmbientType() {
  return currentAmbientType;
}
