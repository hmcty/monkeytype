/**
 * Note generator for piano sightreading
 * Generates random notes based on difficulty level
 */

import { randomIntFromRange } from "@monkeytype/util/numbers";
import { midiNoteToNoteName } from "./note-utils";

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

// Flat equivalents for sharps
const NOTE_NAMES_FLAT = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

const SCALE_TYPE_INTERVALS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  blues: [0, 3, 5, 6, 7, 10],
};

/**
 * Generate a random note based on scale and key
 * @returns Note name with octave (e.g., "C4", "F#5")
 */
export function getRandomNote(
  scale_type: string = "major",
  key: string = "E",
): string {
  let root = 72; // 1 octave above middle C
  if (NOTE_NAMES.includes(key)) {
    // Adjust root based on key if necessary
    root += NOTE_NAMES.indexOf(key);
  } else if (NOTE_NAMES_FLAT.includes(key)) {
    root += NOTE_NAMES_FLAT.indexOf(key);
  } // TODO: throw error

  // Flip coin to lower by an octave
  if (Math.random() < 0.5 || true) {
    root -= 12;
  }

  // Draw a random inter
  const scale = SCALE_TYPE_INTERVALS[scale_type];
  if (scale === undefined) {
    throw new Error(`Unknown scale type: ${scale_type}`);
  }

  const interval = scale[randomIntFromRange(0, scale.length - 1)];
  return midiNoteToNoteName(root + interval);
}
