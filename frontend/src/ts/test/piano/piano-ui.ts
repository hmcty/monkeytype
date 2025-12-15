/**
 * Piano UI integration
 * Manages VexFlow rendering and note tracking for piano sightreading
 */

import { Factory, StemmableNote, EasyScore } from "vexflow";
import * as ConfigEvent from "../../observables/config-event";
import * as TestUi from "../test-ui";
import * as ActivePage from "../../states/active-page";

const BEATS_PER_MEASURE = 4;
const MEASURES_TO_RENDER = 4;
const VISIBLE_NOTE_COUNT = BEATS_PER_MEASURE * MEASURES_TO_RENDER;

class StaveDisplay {
  // VexFlow components
  currentNoteIndex: number;
  allNotes: string[];

  // Theme mapping
  wordElToNote: Map<HTMLElement, StemmableNote>;
  observer: MutationObserver;

  mainColor: string | null = null;
  textColor: string | null = null;
  correctColor: string | null = null;
  incorrectColor: string | null = null;
  untypedColor: string | null = null;

  constructor() {
    this.currentNoteIndex = 0;
    this.allNotes = [];

    this.wordElToNote = new Map();
    this.observer = new MutationObserver(this.onWordMutation.bind(this));
    this.fetchThemeColors();
  }

  fetchThemeColors(): void {
    const wordsEl: HTMLElement | null = document.getElementById("words");
    if (!wordsEl) {
      console.warn("[StaveDisplay] #words element not found for theme fetch");
      return;
    }

    const st = getComputedStyle(document.body);
    this.mainColor = st.getPropertyValue("--main-color").trim();
    this.textColor = st.getPropertyValue("--text-color").trim();

    const wordsSt = getComputedStyle(wordsEl);
    this.correctColor = wordsSt
      .getPropertyValue("--correct-letter-color")
      .trim();
    this.incorrectColor = wordsSt
      .getPropertyValue("--incorrect-letter-color")
      .trim();
    this.untypedColor = wordsSt
      .getPropertyValue("--untyped-letter-color")
      .trim();
  }

  getContainer(): HTMLElement {
    let container = document.getElementById("staveContainer");
    if (!container) {
      const wordsEl = document.getElementById("words");
      if (!wordsEl) {
        throw new Error("[Piano] Parent element not found");
      }

      // Assume #words may have been replaced, so reattach observer
      this.observer.disconnect();
      this.observer.observe(wordsEl, {
        attributes: true,
        attributeFilter: ["class"],
        subtree: true,
      });

      container = document.createElement("div");
      container.id = "staveContainer";
      container.style.position = "relative";
      container.style.pointerEvents = "none";
      container.style.zIndex = "10";
      container.style.display = "flex";
      container.style.flexDirection = "row";
      container.style.alignItems = "center";
      container.style.justifyContent = "center";
      wordsEl.prepend(container);
    }

    return container;
  }

  applyThemeToNote(wordEl: HTMLElement, note: StemmableNote) {
    let newColor = this.untypedColor;
    if (wordEl.classList.contains("error")) {
      newColor = this.incorrectColor;
    } else if (wordEl.classList.contains("typed")) {
      newColor = this.correctColor;
    } else if (wordEl.classList.contains("active")) {
      newColor = this.mainColor; // Active note color
    }

    // If no SVG element exists, assume we are pre-render and set style
    let svgEl: SVGElement | null = note.getSVGElement();
    if (svgEl) {
      svgEl.querySelectorAll("*").forEach((child) => {
        child.setAttribute("fill", newColor);
        child.setAttribute("stroke", newColor);
      });
    } else {
      note.setStyle({ fillStyle: newColor, strokeStyle: newColor });
    }
  }

  onWordMutation(mutations: MutationRecord[]) {
    for (const mut of mutations) {
      if (mut.type !== "attributes" || mut.attributeName !== "class") {
        continue;
      }

      const wordEl = mut.target as HTMLElement;
      const note = this.wordElToNote.get(wordEl);
      if (note) {
        this.applyThemeToNote(wordEl, note);
      }
    }
  }

  render() {
    if (ActivePage.get() !== "test") {
      return;
    }

    // TODO: Confirm a new factory is required for each render
    const containerEl = this.getContainer();
    containerEl.innerHTML = "";

    const { width, height } = getStaveDimensions();
    const vf = new Factory({
      renderer: {
        elementId: containerEl.id,
        width: width,
        height: height,
      },
    });

    let startIndex = Math.max(0, this.currentNoteIndex - 4);
    // startIndex = startIndex - (startIndex % BEATS_PER_MEASURE); // Align to measure
    const endIndex = Math.min(
      startIndex + VISIBLE_NOTE_COUNT,
      this.allNotes.length,
    );

    const visibleNotes = this.allNotes.slice(startIndex, endIndex);
    if (visibleNotes.length <= 0) {
      console.warn("[StaveDisplay] No notes to render");
      return;
    }

    // Convert to VexFlow format and pad with rests
    let stemmableNotes = visibleNotes.map((note) => {
      return `${noteToVexFlowNotation(note)}/q`;
    });
    if (stemmableNotes.length < VISIBLE_NOTE_COUNT) {
      const restsToAdd = VISIBLE_NOTE_COUNT - stemmableNotes.length;
      for (let i = 0; i < restsToAdd; i++) {
        stemmableNotes.push("B5/rq");
      }
    }

    const score = vf.EasyScore();
    score.set({ time: "4/4" });

    this.wordElToNote.clear();
    const bar_width = width / MEASURES_TO_RENDER;
    for (let i = 0; i < MEASURES_TO_RENDER; i++) {
      const system = vf.System({
        x: i * bar_width,
        width: bar_width,
      });

      const barStartIndex = i * BEATS_PER_MEASURE;
      const barEndIndex = barStartIndex + BEATS_PER_MEASURE;
      const barStr = stemmableNotes
        .slice(barStartIndex, barEndIndex)
        .join(", ");
      const notes = score.notes(barStr);

      for (let n = 0; n < notes.length; n++) {
        const globalNoteIndex = startIndex + i * BEATS_PER_MEASURE + n;
        const targetNode = TestUi.getWordElement(globalNoteIndex);
        if (!targetNode) {
          console.warn(
            `[StaveDisplay] No target node found for note index ${globalNoteIndex}`,
          );
          continue;
        }

        this.wordElToNote.set(targetNode, notes[n]);
        this.applyThemeToNote(targetNode, notes[n]);
      }

      const voice = score.voice(notes);
      const stave = system.addStave({
        voices: [voice],
        options: {
          spacingBetweenLinesPx: 10,
        },
      });

      if (i === 0) {
        // TODO(hmcty): Make configurable
        stave.addClef("treble");
        stave.addTimeSignature("4/4");
      }

      stave.setStyle({
        fillStyle: this.textColor,
        strokeStyle: this.textColor,
      });
    }

    try {
      vf.draw();
    } catch (error) {
      console.error("[StaveDisplay] Failed to render notes:", error);
    }
  }

  addNote(note: string) {
    this.allNotes.push(note);
  }

  reset() {
    this.currentNoteIndex = 0;
    this.allNotes = [];
    this.wordElToNote.clear();
    this.getContainer().innerHTML = "";
  }

  advanceNote() {
    this.currentNoteIndex++;
    this.render();
  }
}

// class NoteLetterSync {
//   theme_colors: Map<ThemeColors.ColorName, string> | null;

//   constructor(letterContainer) {
//     this.letterContainer = letterContainer;
//     this.noteMap = new Map(); // letter div -> SVG element(s)
//     this.observer = new MutationObserver(this.handleMutations.bind(this));
//     ThemeColors.getAll().then((colors) => {
//       this.theme_colors = colors;
//       this.updateAll();
//     });
//   }

//   sync(letterDiv, svgNote) {
//     console.log("[NoteLetterSync] Syncing", letterDiv, "to", svgNote);
//     this.assignColor(letterDiv as HTMLElement, svgNote);
//     this.noteMap.set(letterDiv, svgNote);
//   }

//   start() {
//     this.observer.observe(this.letterContainer, {
//       attributes: true,
//       attributeFilter: ["class"],
//       subtree: true,
//     });
//   }

//   updateAll() {
//     for (const [letterEl, note] of this.noteMap.entries()) {
//       this.assignColor(letterEl as HTMLElement, note);
//     }
//   }

//   assignColor(wordEl: HTMLElement, note: StemmableNote) {
//     if (!this.theme_colors) {
//       return;
//     }

//     let new_color = this.theme_colors.sub;
//     if (wordEl.classList.contains("error")) {
//       new_color = this.theme_colors.error;
//     } else if (wordEl.classList.contains("typed")) {
//       new_color = this.theme_colors.text;
//     } else if (wordEl.classList.contains("active")) {
//       new_color = this.theme_colors.main; // Active note color
//     }

//     // console.log("[NoteLetterSync] Assigning color", new_color, "to note", note);

//     let svgEl: SVGElement | null = note.getSVGElement();
//     if (svgEl) {
//       svgEl.querySelectorAll("*").forEach((child) => {
//         child.setAttribute("fill", new_color);
//         child.setAttribute("stroke", new_color);
//       });
//     } else {
//       note.setStyle({ fillStyle: new_color, strokeStyle: new_color });
//     }
//   }

//   handleMutations(mutations) {
//     if (!this.theme_colors) {
//       return;
//     }

//     for (const mut of mutatreturn ions) {
//       if (mut.type !== "attributes" || mut.attributeName !== "class") {
//         continue;
//       }

//       // if (mut.target.id === "words") {
//       //   renderNoteWindow();
//       //   continue;
//       // }

//       // console.log("[NoteLetterSync] Mutation observed:", mut);
//       const note: StemmableNote = this.noteMap.get(mut.target);
//       if (note) {
//         this.assignColor(mut.target as HTMLElement, note);
//       }
//     }
//   }
// }

// // Note tracking
// let allNotes: string[] = [];
// let currentNoteIndex = 0;
// // const VISIBLE_NOTE_COUNT = 12; // Number of notes visible at once

// let noteLetterSync: NoteLetterSync | null = null;

let display: StaveDisplay | null = null;

function getStaveDimensions(): { width: number; height: number } {
  // Try to get container dimensions
  const container = document.getElementById("wordsWrapper");
  let width = 500;
  let height = 150;

  if (container) {
    const rect = container.getBoundingClientRect();

    if (rect.width > 0 && rect.height > 0) {
      width = Math.max(500, Math.min(rect.width * 0.9, 2000));
      height = Math.max(150, Math.min(rect.height * 0.8, 1000));
    }
  }

  return { width, height };
}

export function getDisplay(): StaveDisplay {
  if (!display) {
    display = new StaveDisplay();
  }

  return display;
}

// Dimensions - make staff responsive to screen size

/**
 * Initialize the VexFlow renderer on the #words element
 */
export function initializePianoUI(): void {
  console.log("[Piano] Initializing piano UI...");

  // renderNoteWindow();
  getDisplay().render();
}

/**
 * Register a new note to be displayed
 * Called from getWordHtml() for each word generated
 */
export function registerNote(note: string): void {
  getDisplay().addNote(note);

  // Re-render the visible window
  // renderNoteWindow();
  // getDisplay().render();
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

/**
 * Render the current window of visible notes
 */
function renderNoteWindow(): void {
  getDisplay().render();
}

/**
 * Advance to the next note (called when current note is correctly played)
 */
export function advanceNote(): void {
  // Re-render to show the next window
  // renderNoteWindow();
  getDisplay().advanceNote();
}

/**
 * Clean up piano UI
 */
export function cleanupPianoUI(): void {
  getDisplay().reset();
  const staveContainer = document.getElementById("staveContainer");
  if (staveContainer) {
    staveContainer.remove();
  }
}

ConfigEvent.subscribe((eventKey, _eventValue) => {
  if (eventKey === "theme") {
    getDisplay().fetchThemeColors();
    getDisplay().render();
  }
});
