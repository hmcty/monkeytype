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
 * Unicode Private Use Area base for encoding notes
 * We use U+E000 as the base (start of Private Use Area)
 */
const NOTE_ENCODING_BASE = 0xe000;

/**
 * Note name to index mapping
 */
const NOTE_TO_INDEX: Record<string, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

const INDEX_TO_NOTE: string[] = ["C", "D", "E", "F", "G", "A", "B"];

/**
 * Accidental to index mapping
 */
const ACCIDENTAL_TO_INDEX: Record<string, number> = {
  "": 0, // Natural
  "#": 1, // Sharp
  b: 2, // Flat
};

const INDEX_TO_ACCIDENTAL: string[] = ["", "#", "b"];

/**
 * Encode a note (e.g., "C#4") as a single Unicode character
 * Format: base + (noteIndex << 6) + (accidentalIndex << 4) + octave
 * @param noteName - Note name with octave (e.g., "C4", "F#5", "Db3")
 * @returns Single character encoding the note
 */
export function encodeNote(noteName: string): string {
  // Parse note name (e.g., "C#4" -> "C", "#", "4")
  const match = noteName.match(/^([A-G])([#b]?)(\d)$/);
  if (!match) {
    throw new Error(`Invalid note format: ${noteName}`);
  }

  const [, note, accidental, octaveStr] = match;
  const noteIndex = NOTE_TO_INDEX[note];
  const accidentalIndex = ACCIDENTAL_TO_INDEX[accidental || ""];
  const octave = parseInt(octaveStr, 10);

  if (noteIndex === undefined || accidentalIndex === undefined) {
    throw new Error(`Invalid note components: ${noteName}`);
  }

  if (octave < 0 || octave > 9) {
    throw new Error(`Octave out of range (0-9): ${octave}`);
  }

  // Encode: (noteIndex << 6) + (accidentalIndex << 4) + octave
  const encoded = NOTE_ENCODING_BASE + (noteIndex << 6) + (accidentalIndex << 4) + octave;

  return String.fromCharCode(encoded);
}

/**
 * Decode a single character back to a note name
 * @param char - Single character encoding a note
 * @returns Note name with octave (e.g., "C4", "F#5", "Db3")
 */
export function decodeNote(char: string): string {
  const charCode = char.charCodeAt(0);
  const value = charCode - NOTE_ENCODING_BASE;

  if (value < 0 || charCode < NOTE_ENCODING_BASE) {
    throw new Error(`Invalid encoded note character: ${char} (code: ${charCode})`);
  }

  // Decode: extract bits
  const octave = value & 0x0f; // Last 4 bits
  const accidentalIndex = (value >> 4) & 0x03; // Next 2 bits
  const noteIndex = (value >> 6) & 0x07; // Next 3 bits

  const note = INDEX_TO_NOTE[noteIndex];
  const accidental = INDEX_TO_ACCIDENTAL[accidentalIndex];

  if (!note || accidental === undefined) {
    throw new Error(`Failed to decode note: ${char} (value: ${value})`);
  }

  return `${note}${accidental}${octave}`;
}

/**
 * Check if a character is an encoded note
 * @param char - Character to check
 * @returns true if the character is an encoded note
 */
export function isEncodedNote(char: string): boolean {
  if (char.length !== 1) return false;
  const charCode = char.charCodeAt(0);
  return charCode >= NOTE_ENCODING_BASE && charCode < NOTE_ENCODING_BASE + 0x400; // Max encoding space
}

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
    console.log("[Piano] Failed to parse note:", note);
    return null;
  }

  const [fullName, noteName, accidental, octaveStr] = match;
  console.log("[Piano] Parsing note:", { fullName, noteName, accidental, octaveStr });
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
