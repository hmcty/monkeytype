/**
 * Piano UI integration
 * Connects VexFlow staff rendering with Monkeytype's test UI
 */

import { renderNote } from "./staff-renderer";
import * as ActivePage from "../../states/active-page";

/**
 * Initialize piano UI rendering
 * Sets up MutationObserver to render staff notation when note elements appear
 */
let renderInterval: number | null = null;

export function initializePianoUI(): void {
  console.log("[PianoUI] Initializing piano UI...");
  const wordsElement = document.querySelector("#words");
  if (!wordsElement) {
    console.error("[PianoUI] Words element not found");
    return;
  }

  console.log("[PianoUI] Words element found, rendering existing noteStaffs");
  // Render any existing noteStaff elements
  renderAllNoteStaffs();

  // Set up observer for dynamic rendering
  // const observer = new MutationObserver((mutations) => {
  //   console.log(
  //     "[PianoUI] MutationObserver triggered,",
  //     mutations.length,
  //     "mutations",
  //   );
  //   for (const mutation of mutations) {
  //     if (mutation.type === "childList") {
  //       // Check for new noteStaff elements
  //       renderAllNoteStaffs();
  //     }
  //   }
  // });

  // Observe the words container for changes
  // observer.observe(wordsElement, {
  //   childList: true,
  //   subtree: true,
  // });

  // Also set up continuous rendering as a backup
  // This ensures staffs persist even if MutationObserver misses updates
  // renderInterval = window.setInterval(() => {
  //   renderAllNoteStaffs();
  // }, 100); // Check every 100ms

  console.log(
    "[PianoUI] MutationObserver attached and continuous rendering started",
  );
  // Store observer for cleanup
  // (window as any).__pianoUIObserver = observer;
}

/**
 * Render all noteStaff elements that haven't been rendered yet
 */
function renderAllNoteStaffs(): void {
  // Only render if we're on the test page
  if (ActivePage.get() !== "test") {
    console.log("[PianoUI] Not on test page, skipping render");
    return;
  }

  // Find all word containers - re-render even if previously rendered
  // This ensures staffs persist even if Monkeytype's UI overwrites them
  const words = document.querySelectorAll<HTMLElement>("#words .word");

  console.log("[PianoUI] Found", words.length, "word elements to check");

  for (const wordContainer of words) {
    // Check if this word already has a staff rendered
    const existingStaff = wordContainer.querySelector(".noteStaff svg");
    if (existingStaff) {
      // Staff already rendered and still present, skip
      continue;
    }

    // Get the full note name from the word content
    const noteName = wordContainer.textContent?.trim() || "";

    console.log(
      "[PianoUI] Rendering note:",
      noteName,
      "in word container:",
      wordContainer,
    );

    if (noteName && noteName.length > 0) {
      try {
        // Create a staff container inside the word
        const staffContainer = document.createElement("div");
        staffContainer.className = "noteStaff";
        staffContainer.setAttribute("data-note", noteName);

        // Clear the word and add the staff
        wordContainer.innerHTML = "";
        wordContainer.appendChild(staffContainer);

        // Render the note on the staff
        renderNote(staffContainer, noteName);

        // Mark as rendered
        wordContainer.classList.add("piano-rendered");
        console.log("[PianoUI] Successfully rendered note:", noteName);
      } catch (error) {
        console.error(`[PianoUI] Failed to render note ${noteName}:`, error);
      }
    }
  }
}

/**
 * Clean up piano UI
 */
export function cleanupPianoUI(): void {
  console.log("[PianoUI] Cleaning up piano UI");

  // Clear the rendering interval
  if (renderInterval !== null) {
    clearInterval(renderInterval);
    renderInterval = null;
    console.log("[PianoUI] Cleared rendering interval");
  }

  // const observer = (window as any).__pianoUIObserver as
  //   | MutationObserver
  //   | undefined;
  // if (observer) {
  //   observer.disconnect();
  // delete (window as any).__pianoUIObserver;
  // }
}

/**
 * Force re-render all notes (useful after theme changes)
 */
export function refreshAllNotes(): void {
  const noteStaffs = document.querySelectorAll<HTMLElement>(".noteStaff");

  for (const container of noteStaffs) {
    const noteName = container.getAttribute("data-note");
    container.classList.remove("rendered");
    // Handle nullish/empty case explicitly
    if (noteName === null || noteName === "") {
      console.warn(
        "Note staff container missing data-note attribute:",
        container,
      );
      continue;
    }

    if (noteName) {
      try {
        renderNote(container, noteName);
        container.classList.add("rendered");
      } catch (error) {
        console.error(`Failed to re-render note ${noteName}:`, error);
      }
    }
  }
}
