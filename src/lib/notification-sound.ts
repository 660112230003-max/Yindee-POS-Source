/**
 * Kitchen notification sound utility using Web Audio API.
 * No external audio files needed — generates beep tones programmatically.
 */

const STORAGE_KEY = "pos_kitchen_sound_enabled";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtxClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

if (typeof window !== "undefined") {
  const unlock = () => {
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener("click", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

/** Play a two-tone "ding-ding" notification */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // First beep (higher pitch)
    playTone(ctx, 880, now, 0.15);
    // Second beep (even higher, slight delay)
    playTone(ctx, 1100, now + 0.18, 0.15);
  } catch {
    // Audio not supported — silently ignore
  }
}

function playTone(ctx: AudioContext, freq: number, startTime: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0.3, startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/** Check if kitchen sound is enabled (default: true) */
export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem(STORAGE_KEY);
  return val !== "false"; // default enabled
}

/** Toggle sound on/off */
export function toggleSound(): boolean {
  const next = !isSoundEnabled();
  localStorage.setItem(STORAGE_KEY, String(next));
  return next;
}
