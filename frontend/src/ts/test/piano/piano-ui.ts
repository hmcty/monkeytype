/**
 * Piano UI integration
 * Manages VexFlow rendering and note tracking for piano sightreading
 */

import { Factory, StemmableNote, Annotation } from "vexflow";
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
  currentStaveIndex: number;
  currentStaveEndIndex: number;

  // Theme mapping
  wordElToNote: Map<HTMLElement, StemmableNote>;
  observer: MutationObserver;
  resizeObserver: ResizeObserver;
  renderedStaves: Set<number>;
  resizeDebounceTimer: number | null = null;

  mainColor: string | null = null;
  textColor: string | null = null;
  correctColor: string | null = null;
  incorrectColor: string | null = null;
  untypedColor: string | null = null;

  constructor() {
    this.currentNoteIndex = 0;
    this.currentStaveIndex = 0;
    this.currentStaveEndIndex = 0;

    this.wordElToNote = new Map();
    this.renderedStaves = new Set();
    this.observer = new MutationObserver(this.onWordMutation.bind(this));
    // eslint-disable-next-line compat/compat -- ResizeObserver used for piano UI responsiveness
    this.resizeObserver = new ResizeObserver(this.onResize.bind(this));
    this.fetchThemeColors();
    this.setupResizeObserver();
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

  setupResizeObserver(): void {
    const wordsWrapper = document.getElementById("wordsWrapper");
    if (wordsWrapper !== null) {
      this.resizeObserver.observe(wordsWrapper);
    }
  }

  onResize(entries: ResizeObserverEntry[]): void {
    if (entries.length === 0) return;

    // Don't try to resize if we're not on the test page
    if (ActivePage.get() !== "test") return;

    // Debounce resize events to avoid excessive re-rendering
    if (this.resizeDebounceTimer !== null) {
      clearTimeout(this.resizeDebounceTimer);
    }

    this.resizeDebounceTimer = window.setTimeout(() => {
      this.reRenderAllStaves();
      this.resizeDebounceTimer = null;
    }, 50);
  }

  reRenderAllStaves(): void {
    if (this.renderedStaves.size === 0) return;

    // Don't try to re-render if we're not on the test page
    if (ActivePage.get() !== "test") return;

    // Check if the container still exists
    const container = document.getElementById("staveContainer");
    if (container === null) return;

    // Check if dimensions have actually changed by comparing with first rendered stave
    const newDimensions = getStaveDimensions();
    const firstStaveIndex = Array.from(this.renderedStaves)[0];
    const firstStaveEl = this.getStave(firstStaveIndex);

    if (firstStaveEl !== null) {
      const svg = firstStaveEl.querySelector("svg");
      if (svg !== null) {
        const currentWidth = parseInt(svg.getAttribute("width") ?? "0");
        const currentHeight = parseInt(svg.getAttribute("height") ?? "0");

        // If dimensions match, no need to re-render
        if (
          currentWidth === newDimensions.width &&
          currentHeight === newDimensions.height
        ) {
          return;
        }
      }
    }

    // Save current scroll position
    const scrollTop = container.scrollTop;

    // Clear wordElToNote mappings as we'll rebuild them
    this.wordElToNote.clear();

    // Explicitly remove all existing staves before re-rendering
    const stavesToRender = Array.from(this.renderedStaves);
    stavesToRender.forEach((staveIndex) => {
      const staveEl = this.getStave(staveIndex);
      if (staveEl !== null) {
        staveEl.remove();
      }
    });

    // Re-render each stave with new dimensions
    this.renderedStaves.clear();
    stavesToRender.forEach((staveIndex) => {
      this.renderStave(staveIndex);
    });

    // Restore scroll position
    container.scrollTop = scrollTop;
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
      container.style.pointerEvents = "auto";
      container.style.zIndex = "10";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.alignItems = "center";
      container.style.justifyContent = "flex-start";
      container.style.maxHeight = "60vh";
      container.style.overflowY = "auto";
      container.style.scrollBehavior = "smooth";
      wordsEl.prepend(container);
    }

    return container;
  }

  applyThemeToNote(wordEl: HTMLElement, note: StemmableNote): void {
    let newColor = this.untypedColor;
    const isTyped = wordEl.classList.contains("typed");

    if (wordEl.classList.contains("error")) {
      newColor = this.incorrectColor;
    } else if (isTyped) {
      newColor = this.correctColor;
    } else if (wordEl.classList.contains("active")) {
      newColor = this.mainColor; // Active note color
    }

    // If no SVG element exists, assume we are pre-render and set style
    let svgEl: SVGElement | null = note.getSVGElement();
    if (svgEl !== null && typeof newColor === "string" && newColor !== "") {
      svgEl.querySelectorAll("*").forEach((child) => {
        // Skip annotation elements when applying note color
        if (child.getAttribute("class")?.includes("vf-annotation")) {
          return;
        }
        child.setAttribute("fill", newColor);
        child.setAttribute("stroke", newColor);
      });

      // Handle annotation visibility with CSS class
      const annotations = svgEl.querySelectorAll(".vf-annotation");
      annotations.forEach((annotation) => {
        if (isTyped) {
          annotation.classList.add("show");
        } else {
          annotation.classList.remove("show");
        }
      });
    } else if (typeof newColor === "string" && newColor !== "") {
      note.setStyle({ fillStyle: newColor, strokeStyle: newColor });
    }
  }

  onWordMutation(mutations: MutationRecord[]): void {
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

  getStave(index: number): HTMLElement | null {
    const staveEl = document.getElementById(`stave${index}`);
    return staveEl;
  }

  getStavesToPreRender(): number {
    const container = document.getElementById("staveContainer");
    if (container === null) return 3;

    const containerHeight = container.clientHeight;
    const { height: staveHeight } = getStaveDimensions();

    // Calculate how many staves fit in viewport + 1 extra
    const stavesInViewport = Math.ceil(containerHeight / staveHeight);
    return Math.max(3, stavesInViewport + 1);
  }

  renderStave(staveIndexToRender: number): void {
    const containerEl = this.getContainer();

    // Create a new div to hold stave with id: stave{Idx}
    const staveEl = document.createElement("div");
    staveEl.id = `stave${staveIndexToRender}`;
    staveEl.className = "stave";

    console.log(`[StaveDisplay] Rendering stave index ${staveIndexToRender}`);

    // Check if this stave should be marked inactive
    if (staveIndexToRender < this.currentStaveIndex) {
      staveEl.classList.add("inactive");
    }
    containerEl.appendChild(staveEl);

    const { width, height } = getStaveDimensions();
    const vf = new Factory({
      renderer: {
        elementId: staveEl.id,
        width: width,
        height: height,
      },
    });

    let startIndex = staveIndexToRender * VISIBLE_NOTE_COUNT;
    let endIndex = startIndex;

    // Parse notes from word elements
    let notesToRender = [];
    while (endIndex - startIndex < VISIBLE_NOTE_COUNT) {
      let wordEl = TestUi.getWordElement(endIndex);
      if (!wordEl) {
        break;
      }

      const noteName = wordEl.childNodes[0].textContent;
      const note = `${noteToVexFlowNotation(noteName)}/q`;
      notesToRender.push({ wordEl: wordEl, note: note, noteName: noteName });
      endIndex++;
    }

    if (staveIndexToRender === this.currentStaveIndex) {
      this.currentStaveEndIndex = endIndex;
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

    const bar_width = width / MEASURES_TO_RENDER;
    const allNotesAndWords: Array<{
      wordEl: HTMLElement;
      note: StemmableNote;
    }> = [];

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

      // Add annotations and track notes for later theme application
      barNotesToRender.forEach((n, idx) => {
        // If no word element, assume it's a rest
        if (n.wordEl === null) {
          if (this.untypedColor === null) {
            return;
          }

          notes[idx].setStyle({
            fillStyle: this.untypedColor,
            strokeStyle: this.untypedColor,
          });
        } else if (notes[idx] !== undefined) {
          // Add annotation with note name
          const annotation = new Annotation(n.noteName);
          annotation.setVerticalJustification(
            Annotation.VerticalJustify.BOTTOM,
          );
          annotation.setFont("Arial", 10);

          // Set text color for annotations
          if (this.textColor !== null) {
            annotation.setStyle({
              fillStyle: this.textColor,
              strokeStyle: this.textColor,
            });
          }

          notes[idx].addModifier(annotation, 0);

          this.wordElToNote.set(n.wordEl, notes[idx]);
          // Store for theme application after SVG is created
          allNotesAndWords.push({ wordEl: n.wordEl, note: notes[idx] });
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

      if (this.textColor !== null) {
        stave.setStyle({
          fillStyle: this.textColor,
          strokeStyle: this.textColor,
        });
      }
    }

    try {
      vf.draw();
      this.renderedStaves.add(staveIndexToRender);

      // Apply themes after SVG is created
      allNotesAndWords.forEach(({ wordEl, note }) => {
        this.applyThemeToNote(wordEl, note);
      });
    } catch (error) {
      console.error("[StaveDisplay] Failed to render notes:", error);
    }
  }

  Render(): void {
    if (ActivePage.get() !== "test") {
      return;
    }

    // Determine starting point for rendering
    const oldStaveEl = this.getStave(this.currentStaveIndex);
    let startStaveIndex = this.currentStaveIndex;

    // If current stave doesn't exist, start from there
    if (oldStaveEl === null) {
      startStaveIndex = this.currentStaveIndex;
    } else {
      // Check if we should start rendering ahead
      const nextStaveStart = (this.currentStaveIndex + 1) * VISIBLE_NOTE_COUNT;
      const lookaheadIndex = nextStaveStart - VISIBLE_NOTE_COUNT;
      if (this.currentNoteIndex < lookaheadIndex) {
        // Too early to render ahead, but still pre-render if needed
        startStaveIndex = this.currentStaveIndex;
      } else {
        startStaveIndex = this.currentStaveIndex;
      }
    }

    // Calculate how many staves to pre-render
    const stavesToPreRender = this.getStavesToPreRender();

    // Render staves to fill viewport + 1
    for (let i = 0; i < stavesToPreRender; i++) {
      const staveIndex = startStaveIndex + i;

      // Check if we have enough word elements for this stave
      const staveStartWordIndex = staveIndex * VISIBLE_NOTE_COUNT;
      const hasWords = TestUi.getWordElement(staveStartWordIndex) !== null;
      if (!hasWords && i > 0) {
        // Stop if no words available (but always render at least current stave)
        break;
      }

      // Only render if not already rendered
      if (!this.getStave(staveIndex)) {
        this.renderStave(staveIndex);
      }
    }
  }

  Reset(): void {
    this.currentNoteIndex = 0;
    this.currentStaveIndex = 0;
    this.currentStaveEndIndex = 0;
    this.renderedStaves.clear();
    this.wordElToNote.clear();

    // Clear any pending resize timer
    if (this.resizeDebounceTimer !== null) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }

    // Clear all staves from container
    const container = document.getElementById("staveContainer");
    if (container !== null) {
      container.innerHTML = "";
      container.scrollTop = 0;
    }

    this.Render();
  }

  Cleanup(): void {
    // Disconnect observers to prevent errors when DOM elements are removed
    this.observer.disconnect();
    this.resizeObserver.disconnect();

    // Clear any pending timers
    if (this.resizeDebounceTimer !== null) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }

    // Clear data structures
    this.renderedStaves.clear();
    this.wordElToNote.clear();
  }

  AdvanceNote(): void {
    this.currentNoteIndex++;
    this.Render();

    const nextStaveStart = (this.currentStaveIndex + 1) * VISIBLE_NOTE_COUNT;
    if (this.currentNoteIndex >= nextStaveStart) {
      const oldStaveEl = this.getStave(this.currentStaveIndex);
      if (oldStaveEl !== null) {
        oldStaveEl.classList.add("inactive");
      }

      this.currentStaveIndex += 1;
    }

    const newStaveEl = this.getStave(this.currentStaveIndex);
    if (newStaveEl !== null) {
      newStaveEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  static GetInstance(): PianoUi {
    if (this.#instance === null) {
      this.#instance = new PianoUi();
    }
    return this.#instance;
  }
}

function getStaveDimensions(): { width: number; height: number } {
  const container = document.getElementById("wordsWrapper");
  let width = 500;
  let height = 150;

  if (container !== null) {
    const rect = container.getBoundingClientRect();

    if (rect.width > 0 && rect.height > 0) {
      width = Math.max(500, Math.min(rect.width * 0.9, 2000));
      // height = Math.max(150, Math.min(rect.height * 0.8, 1000));
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
