/**
 * Note generator for piano sightreading
 * Generates random notes based on difficulty level
 */

import { randomIntFromRange } from "@monkeytype/util/numbers";
import { getNoteRange, midiNoteToNoteName } from "./note-utils";

/**
 * Generate a random note based on difficulty level
 * @param difficulty - Difficulty level (beginner, intermediate, advanced)
 * @returns Note name with octave (e.g., "C4", "F#5")
 */
export function getRandomNote(difficulty: string = "beginner"): string {
  const range = getNoteRange(difficulty);
  const midiNote = randomIntFromRange(range.min, range.max);
  return midiNoteToNoteName(midiNote);
}

/**
 * Generate a sequence of random notes
 * @param count - Number of notes to generate
 * @param difficulty - Difficulty level
 * @returns Array of note names
 */
export function getRandomNotes(
  count: number,
  difficulty: string = "beginner",
): string[] {
  const notes: string[] = [];
  for (let i = 0; i < count; i++) {
    notes.push(getRandomNote(difficulty));
  }
  return notes;
}

/**
 * Generate a scale exercise (for future use)
 * @param rootNote - Root note of the scale
 * @param scaleType - Type of scale (major, minor, etc.)
 * @returns Array of notes in the scale
 */
export function generateScale(
  rootNote: string,
  scaleType: "major" | "minor" = "major",
): string[] {
  // Intervals for major and minor scales
  const _intervals =
    scaleType === "major"
      ? [0, 2, 4, 5, 7, 9, 11, 12] // Major scale
      : [0, 2, 3, 5, 7, 8, 10, 12]; // Natural minor scale

  // This is a simplified version - full implementation would calculate
  // MIDI numbers and convert back to note names
  // For now, return empty array (to be implemented later)
  return [];
}
