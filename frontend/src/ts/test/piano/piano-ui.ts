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

export class PianoUi {
  static #instance: PianoUi | null = null;

  // VexFlow components
  currentNoteIndex: number;

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

  Render() {
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
    let endIndex = startIndex;

    // Parse notes from word elements
    let notesToRender = [];
    while (endIndex - startIndex < VISIBLE_NOTE_COUNT) {
      let wordEl = TestUi.getWordElement(endIndex);
      if (!wordEl) {
        break;
      }

      const note = `${noteToVexFlowNotation(wordEl.childNodes[0].textContent)}/q`;
      notesToRender.push({ wordEl: wordEl, note: note });
      endIndex++;
    }

    // Convert to VexFlow format and pad with rests
    if (notesToRender.length < VISIBLE_NOTE_COUNT) {
      let restsToAdd = VISIBLE_NOTE_COUNT - notesToRender.length;
      while (restsToAdd > 0) {
        notesToRender.push({ wordEl: null, note: "B4/4/r" });
        restsToAdd -= 1;
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

      // Create slice for notes in this bar
      const barStartIndex = i * BEATS_PER_MEASURE;
      const barEndIndex = barStartIndex + BEATS_PER_MEASURE;
      const barNotesToRender = notesToRender.slice(barStartIndex, barEndIndex);
      const barStr = barNotesToRender.map((n) => n.note).join(", ");
      const notes = score.notes(barStr);

      // Apply styles and map mutation observer
      barNotesToRender.forEach((n, idx) => {
        // If no word element, assume it's a rest
        if (n.wordEl === null) {
          notes[idx].setStyle({
            fillStyle: this.untypedColor,
            strokeStyle: this.untypedColor,
          });
        } else {
          this.wordElToNote.set(n.wordEl, notes[idx]);
          this.applyThemeToNote(n.wordEl, notes[idx]);
        }
      });

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

  Reset() {
    this.currentNoteIndex = 0;
    this.Render();
  }

  AdvanceNote() {
    // TODO: At some point, this shouldn't be necessary.
    //       We just need to stack and scroll staves.
    this.currentNoteIndex++;
    this.Render();
  }

  static GetInstance(): PianoUi {
    if (this.#instance == null) {
      this.#instance = new PianoUi();
    }
    return this.#instance;
  }
}

function getStaveDimensions(): { width: number; height: number } {
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

ConfigEvent.subscribe((eventKey, _eventValue) => {
  if (eventKey === "theme") {
    PianoUi.GetInstance().fetchThemeColors();
    PianoUi.GetInstance().Render();
  }
});
