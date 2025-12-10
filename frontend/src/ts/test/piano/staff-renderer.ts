/**
 * Staff renderer using VexFlow
 * Renders musical notes on a staff for piano sightreading
 */

import {
  Renderer,
  Stave,
  StaveNote,
  Formatter,
  Voice,
  Accidental,
  type RendererBackends,
} from "vexflow";
import { parseNote } from "./note-utils";
import Config from "../../config";

/**
 * Render a single note on a musical staff
 * @param container - DOM element to render into
 * @param noteName - Note name with octave (e.g., "C4", "F#5")
 */
export function renderNote(container: HTMLElement, noteName: string): void {
  console.log(
    "[Renderer] renderNote() called for:",
    noteName,
    "container:",
    container,
  );

  // Clear previous content
  container.innerHTML = "";

  // Get clef from config
  const clef = Config.pianoClef || "treble";
  console.log("[Renderer] Using clef:", clef);

  // Parse note
  const parsed = parseNote(noteName);
  if (!parsed) {
    console.error(`[Renderer] Failed to parse note: ${noteName}`);
    return;
  }
  console.log("[Renderer] Parsed note:", parsed);

  try {
    // Create renderer
    console.log("[Renderer] Creating VexFlow renderer...");
    const renderer = new Renderer(
      container as HTMLDivElement,
      Renderer.Backends.SVG as RendererBackends,
    );

    // Set dimensions
    const width = 150;
    const height = 150;
    renderer.resize(width, height);
    console.log(
      "[Renderer] Renderer created with dimensions:",
      width,
      "x",
      height,
    );

    const context = renderer.getContext();
    console.log("[Renderer] Got rendering context:", context);

    // Create stave
    const stave = new Stave(10, 20, width - 20);
    stave.addClef(clef);
    stave.setContext(context).draw();
    console.log("[Renderer] Stave created and drawn");

    // Convert note to VexFlow format
    // VexFlow uses format like "C/4" instead of "C4"
    const vexNote = `${parsed.noteName}${parsed.accidental}/${parsed.octave}`;
    console.log("[Renderer] VexFlow note format:", vexNote);

    // Create note
    const note = new StaveNote({
      keys: [vexNote],
      duration: "q", // Quarter note
      clef: clef,
    });
    console.log("[Renderer] StaveNote created:", note);

    // Add accidental if needed
    if (parsed.accidental) {
      note.addModifier(new Accidental(parsed.accidental));
      console.log("[Renderer] Added accidental:", parsed.accidental);
    }

    // Create voice and add note
    const voice = new Voice({
      numBeats: 1,
      beatValue: 4,
    });
    voice.addTickable(note);
    console.log("[Renderer] Voice created with note");

    // Format and draw
    new Formatter().joinVoices([voice]).format([voice], width - 40);
    voice.draw(context, stave);
    console.log("[Renderer] Voice formatted and drawn");

    // Check if SVG was created
    const svg = container.querySelector("svg");
    console.log("[Renderer] SVG element after rendering:", svg);
    if (svg) {
      console.log(
        "[Renderer] SVG dimensions:",
        svg.getAttribute("width"),
        "x",
        svg.getAttribute("height"),
      );
      console.log("[Renderer] SVG innerHTML length:", svg.innerHTML.length);
    }
  } catch (error) {
    console.error("[Renderer] Error rendering note:", error);
  }
}

/**
 * Render multiple notes on a staff (for future multi-note support)
 * @param container - DOM element to render into
 * @param noteNames - Array of note names
 */
export function renderNotes(container: HTMLElement, noteNames: string[]): void {
  // Clear previous content
  container.innerHTML = "";

  if (noteNames.length === 0) return;

  const clef = Config.pianoClef || "treble";

  try {
    // Create renderer
    const renderer = new Renderer(
      container as HTMLDivElement,
      Renderer.Backends.SVG as RendererBackends,
    );

    // Set dimensions based on number of notes
    const width = Math.max(200, noteNames.length * 80 + 100);
    const height = 150;
    renderer.resize(width, height);

    const context = renderer.getContext();

    // Create stave
    const stave = new Stave(10, 20, width - 20);
    stave.addClef(clef);
    stave.setContext(context).draw();

    // Create notes
    const staveNotes: StaveNote[] = [];

    console.log("Rendering notes:", noteNames);
    for (const noteName of noteNames) {
      const parsed = parseNote(noteName);
      if (!parsed) {
        console.error(`Failed to parse note: ${noteName}`);
        continue;
      }

      const vexNote = `${parsed.noteName}${parsed.accidental}/${parsed.octave}`;

      const note = new StaveNote({
        keys: [vexNote],
        duration: "q",
        clef: clef,
      });

      if (parsed.accidental) {
        note.addModifier(new Accidental(parsed.accidental));
      }

      staveNotes.push(note);
    }

    // Create voice
    const voice = new Voice({
      numBeats: noteNames.length,
      beatValue: 4,
    });

    staveNotes.forEach((note) => voice.addTickable(note));

    // Format and draw
    new Formatter().joinVoices([voice]).format([voice], width - 40);
    voice.draw(context, stave);
  } catch (error) {
    console.error("Error rendering notes:", error);
  }
}

/**
 * Apply styling to indicate note state (correct, incorrect, untyped)
 * This is done via CSS classes on the parent container
 */
export function applyNoteState(
  container: HTMLElement,
  state: "correct" | "incorrect" | "untyped",
): void {
  // Remove existing state classes
  container.classList.remove("note-correct", "note-incorrect", "note-untyped");

  // Add new state class
  container.classList.add(`note-${state}`);
}

/**
 * Get staff dimensions for responsive layout
 */
export function getStaffDimensions(noteCount: number = 1): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(150, noteCount * 80 + 100),
    height: 150,
  };
}

/**
 * Clean up a staff rendering (remove SVG elements)
 */
export function cleanupStaff(container: HTMLElement): void {
  container.innerHTML = "";
}
