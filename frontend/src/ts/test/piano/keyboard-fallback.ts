/**
 * Keyboard fallback for piano sightreading
 * Maps computer keyboard keys to musical notes when MIDI is not available
 */

import { emulateInsertText } from "../../input/handlers/insert-text";
import { encodeNote } from "./note-utils";

/**
 * Keyboard to note mapping
 * White keys: a s d f g h j k (C D E F G A B C)
 * Black keys (sharps): w e t y u (C# D# F# G# A#)
 */
const KEYBOARD_TO_NOTE_MAP: Record<string, string> = {
  // White keys (natural notes) - C major scale
  a: "C4",
  s: "D4",
  d: "E4",
  f: "F4",
  g: "G4",
  h: "A4",
  j: "B4",
  k: "C5",

  // Black keys (sharps/flats)
  w: "C#4",
  e: "D#4",
  t: "F#4",
  y: "G#4",
  u: "A#4",

  // Additional octave for extended range
  z: "C3",
  x: "D3",
  c: "E3",
  v: "F3",
  b: "G3",
  n: "A3",
  m: "B3",
};

let isActive = false;
let keydownHandler: ((event: KeyboardEvent) => void) | null = null;

/**
 * Check if keyboard fallback is active
 */
export function isKeyboardFallbackActive(): boolean {
  return isActive;
}

/**
 * Initialize keyboard fallback mode
 */
export function initializeKeyboardFallback(): void {
  if (isActive) return;

  keydownHandler = handleKeydown;
  // Use capture phase to intercept before Monkeytype's handlers
  document.addEventListener("keydown", keydownHandler, true);
  isActive = true;

  console.log("[Piano] Keyboard fallback mode activated");
  console.log("[Piano] Press a-k for notes C4-C5, w/e/t/y/u for sharps");
}

/**
 * Handle keyboard events and convert to note input
 */
export function handleKeydown(event: KeyboardEvent): void {
  const key = event.key.toLowerCase();
  console.log("[Piano] Key pressed:", key);

  const noteName = KEYBOARD_TO_NOTE_MAP[key];
  if (noteName === undefined) {
    // Key not mapped to a note
    console.log("[Piano] Key not mapped, ignoring");
    return;
  }

  console.log("[Piano] Mapped to note:", noteName);

  // Encode the note as a single character
  const encodedNote = encodeNote(noteName);

  // Prevent default keyboard behavior
  event.preventDefault();
  event.stopPropagation();

  const now = performance.now();

  console.log("[Piano] Emulating insert of:", noteName, "-> encoded:", encodedNote.charCodeAt(0).toString(16));
  // Inject the encoded note as text input
  void emulateInsertText({
    data: encodedNote,
    now,
  });
}

/**
 * Clean up keyboard fallback listeners
 */
export function cleanupKeyboardFallback(): void {
  if (!isActive) return;

  if (keydownHandler) {
    // Must match the options used in addEventListener
    document.removeEventListener("keydown", keydownHandler, true);
    keydownHandler = null;
  }

  isActive = false;
  console.log("[Piano] Keyboard fallback mode deactivated");
}

/**
 * Get the keyboard mapping for display in UI
 */
export function getKeyboardMapping(): Record<string, string> {
  return { ...KEYBOARD_TO_NOTE_MAP };
}

/**
 * Get a formatted guide for keyboard mapping
 */
export function getKeyboardGuide(): string {
  return `
Keyboard Fallback Mode - Key Mapping:

White Keys (Natural Notes):
  a → C4    s → D4    d → E4    f → F4
  g → G4    h → A4    j → B4    k → C5

Black Keys (Sharps):
  w → C#4   e → D#4   t → F#4
  y → G#4   u → A#4

Lower Octave:
  z → C3    x → D3    c → E3    v → F3
  b → G3    n → A3    m → B3
  `.trim();
}
