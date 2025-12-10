/**
 * Note utilities for piano sightreading
 * Handles MIDI note conversion, note ranges, and enharmonic equivalents
 */

// Standard note names in chromatic order
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

/**
 * Note range definitions by difficulty level
 * MIDI note numbers: 60 = Middle C (C4)
 */
export type NoteRange = {
  min: number;
  max: number;
};

const NOTE_RANGES: Record<string, NoteRange> = {
  beginner: { min: 60, max: 72 }, // C4 to C5 (one octave)
  intermediate: { min: 55, max: 79 }, // G3 to G5 (wider range)
  advanced: { min: 48, max: 84 }, // C3 to C6 (three octaves)
};

/**
 * Convert MIDI note number to note name with octave
 * @param midiNumber - MIDI note number (0-127)
 * @returns Note name with octave (e.g., "C4", "F#5")
 */
export function midiNoteToNoteName(midiNumber: number): string {
  if (midiNumber < 0 || midiNumber > 127) {
    throw new Error(`Invalid MIDI note number: ${midiNumber}`);
  }

  // MIDI note 60 = C4 (Middle C)
  // Octave calculation: MIDI divides notes into octaves of 12
  // Octave number = floor(midiNumber / 12) - 1
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  const noteName = NOTE_NAMES[noteIndex];

  return `${noteName}${octave}`;
}

/**
 * Convert note name to MIDI note number
 * @param noteName - Note name with octave (e.g., "C4", "F#5", "Db3")
 * @returns MIDI note number
 */
export function noteNameToMidiNote(noteName: string): number {
  // Parse note name (e.g., "C4", "F#5", "Db3")
  const match = noteName.match(/^([A-G][#b]?)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid note name: ${noteName}`);
  }

  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);

  // Find note index
  let noteIndex = NOTE_NAMES.indexOf(note);
  if (noteIndex === -1) {
    noteIndex = NOTE_NAMES_FLAT.indexOf(note);
  }
  if (noteIndex === -1) {
    throw new Error(`Unknown note: ${note}`);
  }

  // Calculate MIDI number
  return (octave + 1) * 12 + noteIndex;
}

/**
 * Get note range for a difficulty level
 * @param difficulty - Difficulty level (beginner, intermediate, advanced)
 * @returns Note range object with min and max MIDI numbers
 */
export function getNoteRange(difficulty: string): NoteRange {
  return NOTE_RANGES[difficulty] || NOTE_RANGES.beginner;
}

/**
 * Get enharmonic equivalents for a note
 * (e.g., C# can also be written as Db)
 * @param note - Note name with octave
 * @returns Array of equivalent note names
 */
export function getEnharmonicEquivalent(note: string): string[] {
  const match = note.match(/^([A-G][#b]?)(\d+)$/);
  if (!match) return [];

  const [, notePart, octave] = match;
  if (!notePart) return [];

  const enharmonicMap: Record<string, string> = {
    "C#": "Db",
    Db: "C#",
    "D#": "Eb",
    Eb: "D#",
    "F#": "Gb",
    Gb: "F#",
    "G#": "Ab",
    Ab: "G#",
    "A#": "Bb",
    Bb: "A#",
  };

  const equivalent = enharmonicMap[notePart];
  if (equivalent) {
    return [note, `${equivalent}${octave}`];
  }

  // Natural notes have no enharmonic equivalents (in standard notation)
  return [note];
}

/**
 * Check if two notes are enharmonically equivalent
 * @param note1 - First note name
 * @param note2 - Second note name
 * @returns true if notes are equivalent
 */
export function areNotesEquivalent(note1: string, note2: string): boolean {
  if (note1 === note2) return true;

  const equivalents = getEnharmonicEquivalent(note1);
  return equivalents.includes(note2);
}

/**
 * Parse note into components (note name, accidental, octave)
 */
export type ParsedNote = {
  noteName: string; // Just the letter (C, D, E, etc.)
  accidental: string; // "", "#", or "b"
  octave: number;
  fullName: string; // Complete note name (e.g., "C#4")
};

export function parseNote(note: string): ParsedNote | null {
  const match = note.match(/^([A-G])([#b]?)(\d+)$/);
  if (!match) {
    console.log("FAILED TO PARSE NOTE:", note);
    return null;
  }

  const [fullName, noteName, accidental, octaveStr] = match;
  console.log("HERE PARSE NOTE");
  console.log({ fullName, noteName, accidental, octaveStr });
  if (
    fullName == undefined ||
    noteName == undefined ||
    accidental == undefined ||
    octaveStr == undefined
  ) {
    return null;
  }
  return {
    noteName,
    accidental: accidental || "",
    octave: octaveStr ? parseInt(octaveStr, 10) : 4,
    fullName,
  };
}

/**
 * Get all note names in a range (for testing or UI)
 * @param difficulty - Difficulty level
 * @returns Array of note names
 */
export function getNotesInRange(difficulty: string): string[] {
  const range = getNoteRange(difficulty);
  const notes: string[] = [];

  for (let midiNum = range.min; midiNum <= range.max; midiNum++) {
    notes.push(midiNoteToNoteName(midiNum));
  }

  return notes;
}

/**
 * Check if a note is within the range for a difficulty level
 * @param note - Note name with octave
 * @param difficulty - Difficulty level
 * @returns true if note is in range
 */
export function isNoteInRange(note: string, difficulty: string): boolean {
  try {
    const midiNumber = noteNameToMidiNote(note);
    const range = getNoteRange(difficulty);
    return midiNumber >= range.min && midiNumber <= range.max;
  } catch {
    return false;
  }
}
