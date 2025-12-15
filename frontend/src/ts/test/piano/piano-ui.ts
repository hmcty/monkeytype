/**
 * Piano UI integration
 * Manages VexFlow rendering and note tracking for piano sightreading
 */

import { Factory, StemmableNote } from "vexflow";
import * as ActivePage from "../../states/active-page";
import * as Config from "../../config";
import * as TestUi from "../test-ui";
import * as ThemeColors from "../../elements/theme-colors";

// VexFlow factory instance
let vf: Factory | null = null;

class NoteLetterSync {
  theme_colors: Map<ThemeColors.ColorName, string> | null;

  constructor(letterContainer) {
    this.letterContainer = letterContainer;
    this.noteMap = new Map(); // letter div -> SVG element(s)
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    ThemeColors.getAll().then((colors) => {
      this.theme_colors = colors;
      this.updateAll();
    });
  }

  sync(letterDiv, svgNote) {
    console.log("[NoteLetterSync] Syncing", letterDiv, "to", svgNote);
    this.assignColor(letterDiv as HTMLElement, svgNote);
    this.noteMap.set(letterDiv, svgNote);
  }

  start() {
    this.observer.observe(this.letterContainer, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });
  }

  updateAll() {
    for (const [letterEl, note] of this.noteMap.entries()) {
      this.assignColor(letterEl as HTMLElement, note);
    }
  }

  assignColor(wordEl: HTMLElement, note: StemmableNote) {
    if (!this.theme_colors) {
      return;
    }

    let new_color = this.theme_colors.sub;
    if (wordEl.classList.contains("error")) {
      new_color = this.theme_colors.error;
    } else if (wordEl.classList.contains("typed")) {
      new_color = this.theme_colors.text;
    } else if (wordEl.classList.contains("active")) {
      new_color = this.theme_colors.main; // Active note color
    }

    // console.log("[NoteLetterSync] Assigning color", new_color, "to note", note);

    let svgEl: SVGElement | null = note.getSVGElement();
    if (svgEl) {
      svgEl.querySelectorAll("*").forEach((child) => {
        child.setAttribute("fill", new_color);
        child.setAttribute("stroke", new_color);
      });
    } else {
      note.setStyle({ fillStyle: new_color, strokeStyle: new_color });
    }
  }

  handleMutations(mutations) {
    if (!this.theme_colors) {
      return;
    }

    for (const mut of mutations) {
      if (mut.type !== "attributes" || mut.attributeName !== "class") {
        continue;
      }

      // if (mut.target.id === "words") {
      //   renderNoteWindow();
      //   continue;
      // }

      // console.log("[NoteLetterSync] Mutation observed:", mut);
      const note: StemmableNote = this.noteMap.get(mut.target);
      if (note) {
        this.assignColor(mut.target as HTMLElement, note);
      }
    }
  }
}

// Note tracking
let allNotes: string[] = [];
let currentNoteIndex = 0;
// const VISIBLE_NOTE_COUNT = 12; // Number of notes visible at once

let noteLetterSync: NoteLetterSync | null = null;

const BEATS_PER_MEASURE = 4;
const MEASURES_TO_RENDER = 4;
const VISIBLE_NOTE_COUNT = BEATS_PER_MEASURE * MEASURES_TO_RENDER;

// Dimensions - make staff responsive to screen size
function getStaffDimensions(): { width: number; height: number } {
  // Try to get container dimensions
  const container = document.getElementById("wordsWrapper");
  let width = 500;
  let height = 150;

  if (container) {
    const rect = container.getBoundingClientRect();
    console.log("[Piano] Container rect:", rect);

    if (rect.width > 0 && rect.height > 0) {
      width = Math.max(500, Math.min(rect.width * 0.9, 2000));
      height = Math.max(150, Math.min(rect.height * 0.8, 1000));
    }
  }

  console.log("[Piano] Calculated dimensions:", width, "x", height);
  return { width, height };
}

/**
 * Initialize the VexFlow renderer on the #words element
 */
export function initializePianoUI(): void {
  console.log("[Piano] Initializing piano UI...");

  currentNoteIndex = 0;

  renderNoteWindow();
}

/**
 * Register a new note to be displayed
 * Called from getWordHtml() for each word generated
 */
export function registerNote(note: string): void {
  console.log("[Piano] Registering note:", note);
  allNotes.push(note);

  // Re-render the visible window
  // renderNoteWindow();
}

/**
 * Convert a note name to VexFlow notation
 * Examples: C4 -> C/4, C#4 -> C#/4, Db5 -> Db/5
 */
function noteToVexFlowNotation(note: string): string {
  // Parse note name (e.g., "C#4" -> "C#", "4")
  const match = note.match(/^([A-G][#b]?)(\d)$/);
  if (!match) {
    console.warn("[Piano] Invalid note format:", note);
    return "C4"; // Fallback
  }

  const [, noteName, octave] = match;
  return `${noteName}${octave}`;
}

export function markNoteAsPlayed(index: number, correct: boolean): void {}

/**
 * Render the current window of visible notes
 */
function renderNoteWindow(): void {
  // if (ActivePage.get() !== "test") {
  //   console.log("[Piano] Skipping render - not ready or not on test page");
  //   return;
  // }

  try {
    // Get the visible notes (current index + next N notes)
    const startIndex = Math.max(0, currentNoteIndex - 4);
    const endIndex = Math.min(startIndex + VISIBLE_NOTE_COUNT, allNotes.length);
    const visibleNotes = allNotes.slice(startIndex, endIndex);

    if (visibleNotes.length < 0) {
      console.log("[Piano] No notes to render");
      return;
    }

    console.log(
      "[Piano] Rendering notes:",
      visibleNotes,
      "indices",
      startIndex,
      "-",
      endIndex,
    );

    // Get the words container
    const wordsElement = document.getElementById("words");
    if (!wordsElement) {
      console.error("[Piano] #words element not found");
      return;
    }

    // Clear the piano staff container (not the words container!)
    // const pianoStaffContainer = document.getElementById("pianoStaffContainer");
    let pianoStaffContainer = document.getElementById("pianoStaffContainer");
    if (!pianoStaffContainer) {
      pianoStaffContainer = document.createElement("div");
      pianoStaffContainer.id = "pianoStaffContainer";
      pianoStaffContainer.style.position = "relative";
      // pianoStaffContainer.style.width = "100%";
      // pianoStaffContainer.style.minHeight = "800px";
      pianoStaffContainer.style.pointerEvents = "none";
      pianoStaffContainer.style.zIndex = "10";
      pianoStaffContainer.style.display = "flex";
      pianoStaffContainer.style.flexDirection = "row";
      pianoStaffContainer.style.alignItems = "center";
      pianoStaffContainer.style.justifyContent = "center";
      // pianoStaffContainer.style.marginTop = "2rem";
      // pianoStaffContainer.style.backgroundColor = "rgba(255, 0, 0, 0.1)"; // Debug: red tint
      // pianoStaffContainer.style.border = "2px solid red"; // Debug: red border
      // wordsElement.parentElement?.insertBefore(
      //   pianoStaffContainer,
      //   wordsElement,
      // );
      // wordsElement.appendChild(pianoStaffContainer);
      wordsElement.prepend(pianoStaffContainer);
      console.log("[Piano] Created pianoStaffContainer:", pianoStaffContainer);

      noteLetterSync = new NoteLetterSync(wordsElement);
      noteLetterSync.start();
    } else {
      pianoStaffContainer.innerHTML = "";
    }

    // Get responsive dimensions
    const { width, height } = getStaffDimensions();
    console.log("[Piano] Staff dimensions:", width, "x", height);

    // Create a new Factory instance (VexFlow requires fresh factory for each render)
    vf = new Factory({
      renderer: {
        elementId: "pianoStaffContainer",
        width,
        height,
      },
    });

    // Get the clef from config
    const clef = Config.pianoClef || "treble";

    // Create the score and system
    let score = vf.EasyScore();
    score.set({ time: "4/4" });

    // Convert notes to VexFlow format
    // Format: "C#5/q, B4/q, A4/q" (note/duration)
    let vexFlowNotes = visibleNotes.map(
      (note) => `${noteToVexFlowNotation(note)}/q`,
    );
    // .join(", ");
    if (vexFlowNotes.length < VISIBLE_NOTE_COUNT) {
      // Pad with rests to fill the measure
      const restsToAdd = VISIBLE_NOTE_COUNT - vexFlowNotes.length;
      console.log("[Piano] Padding with", restsToAdd, "rests");
      for (let i = 0; i < restsToAdd; i++) {
        vexFlowNotes.push("B5/rq"); // Quarter rest
      }
    }

    console.log("[Piano] VexFlow notation:", vexFlowNotes);

    // Add the stave with notes
    const bar_width = width / MEASURES_TO_RENDER;
    for (let i = 0; i < MEASURES_TO_RENDER; i++) {
      let system = vf.System({
        x: i * bar_width,
        width: bar_width,
      });

      let notes = score.notes(
        vexFlowNotes
          .slice(
            i * BEATS_PER_MEASURE,
            i * BEATS_PER_MEASURE + BEATS_PER_MEASURE,
          )
          .join(", "),
        {
          stem: "up",
          time: "4/4",
        },
      );
      for (let n = 0; n < notes.length; n++) {
        const globalNoteIndex = startIndex + i * BEATS_PER_MEASURE + n;
        const config = { attributes: true };
        const targetNode = TestUi.getWordElement(globalNoteIndex);
        if (!targetNode) {
          console.warn(
            `[Piano] No target node found for note index ${globalNoteIndex}`,
          );
          continue;
        }

        // Sync note letter div with SVG element
        noteLetterSync.sync(targetNode, notes[n]);
      }

      let voice = score.voice(notes);
      console.log("[Piano] Created voice for measure", i, ":", voice);
      let stave = system.addStave({
        voices: [voice],
        options: {
          spacingBetweenLinesPx: 10,
        },
      });
      if (i === 0) {
        stave.addClef(clef);
        stave.addTimeSignature("4/4");
      }
    }

    // Draw the staff
    vf.draw();
    console.log("[Piano] Rendered", visibleNotes.length, "notes");
  } catch (error) {
    console.error("[Piano] Failed to render notes:", error);
  }
}

/**
 * Advance to the next note (called when current note is correctly played)
 */
export function advanceNote(): void {
  console.log(
    "[Piano] Advancing from note",
    currentNoteIndex,
    "to",
    currentNoteIndex + 1,
  );
  currentNoteIndex++;

  // Re-render to show the next window
  renderNoteWindow();
}

/**
 * Get the current note that should be played
 */
export function getCurrentNote(): string | null {
  if (currentNoteIndex < allNotes.length) {
    return allNotes[currentNoteIndex];
  }
  return null;
}

/**
 * Get the total number of notes
 */
export function getTotalNotes(): number {
  return allNotes.length;
}

/**
 * Get the current note index
 */
export function getCurrentNoteIndex(): number {
  return currentNoteIndex;
}

/**
 * Clean up piano UI
 */
export function cleanupPianoUI(): void {
  console.log("[Piano] Cleaning up piano UI");

  // Reset state
  // vf = null;
  // allNotes = [];
  currentNoteIndex = 0;
  noteLetterSync = null;

  // Remove the piano staff container (leave #words intact for Monkeytype)
  const pianoStaffContainer = document.getElementById("pianoStaffContainer");
  if (pianoStaffContainer) {
    pianoStaffContainer.remove();
  }
}

/**
 * Force re-render (useful after theme changes)
 */
export function refreshAllNotes(): void {
  console.log("[Piano] Refreshing all notes");
  renderNoteWindow();
}
