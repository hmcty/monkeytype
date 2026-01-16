import { midiNoteToNoteName, encodeNote } from "./note-utils";
import Config from "../../config";
import { emulateInsertText } from "../../input/handlers/insert-text";

let midiAccess: MIDIAccess | null = null;
let activeInput: MIDIInput | null = null;
let messageHandler: ((event: MIDIMessageEvent) => void) | null = null;

/**
 * Check if Web MIDI API is supported in the current browser
 */
export function checkMidiSupport(): { supported: boolean; message: string } {
  if (typeof navigator.requestMIDIAccess === "undefined") {
    return {
      supported: false,
      message:
        "Web MIDI API not supported. Please use Chrome/Edge or enable MIDI in Firefox (dom.webaudio.midi.enabled).",
    };
  }
  return { supported: true, message: "" };
}

/**
 * Initialize Web MIDI API and request access to MIDI devices
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function initializeMidi(): Promise<boolean> {
  try {
    // Safari 18.3+ supports Web MIDI API - runtime support check happens in checkMidiSupport()
    // eslint-disable-next-line compat/compat
    midiAccess = await navigator.requestMIDIAccess();

    // If a specific device was configured, try to use it
    const configuredDeviceId = Config.pianoMidiDevice;
    if (
      typeof configuredDeviceId === "string" &&
      configuredDeviceId !== "" &&
      configuredDeviceId !== "default"
    ) {
      const device = getMidiInputById(configuredDeviceId);
      if (device !== null) {
        attachMidiListeners(device);
        return true;
      }
      // If configured device not found, fall through to default behavior
      console.warn(
        `[Piano] Configured MIDI device "${configuredDeviceId}" not found, using default`,
      );
    }

    // Otherwise, use the first available input
    const inputs = Array.from(midiAccess.inputs.values());
    console.log("[Piano] Available MIDI inputs:", inputs);
    if (inputs.length > 0) {
      attachMidiListeners(inputs[0]);
      return true;
    } else {
      console.warn("[Piano] No MIDI input devices found");
      return false;
    }
  } catch (error) {
    console.error("[Piano] Failed to initialize MIDI:", error);
    return false;
  }
}

/**
 * Get a MIDI input device by its ID
 */
function getMidiInputById(deviceId: string): MIDIInput | null {
  if (!midiAccess) return null;

  for (const input of midiAccess.inputs.values()) {
    if (input.id === deviceId) {
      return input;
    }
  }
  return null;
}

/**
 * Attach MIDI message listeners to a specific input device
 * @param input - The MIDI input device to listen to
 */
export function attachMidiListeners(input: MIDIInput): void {
  // Remove previous listeners if any
  if (activeInput && messageHandler) {
    activeInput.removeEventListener("midimessage", messageHandler);
  }

  activeInput = input;
  messageHandler = handleMidiMessage;
  activeInput.addEventListener("midimessage", messageHandler);

  console.log(`[Piano] MIDI input attached: ${input.name}`);
}

/**
 * Handle incoming MIDI messages
 * @param event - The MIDI message event
 */
function handleMidiMessage(event: MIDIMessageEvent): void {
  const status = event.data[0] as number;
  const noteNumber = event.data[1] as number;
  const velocity = event.data[2] as number;

  // NOTE_ON: status byte 0x90-0x9F (144-159)
  // Channel 1-16 corresponds to 0x90-0x9F
  const messageType = status & 0xf0; // Upper 4 bits
  const isNoteOn = messageType === 0x90;

  // Ignore NOTE_OFF (velocity 0) and non-note messages
  if (!isNoteOn || velocity === 0) {
    return;
  }

  // Convert MIDI note number to note name (e.g., 60 -> "C4")
  const noteName = midiNoteToNoteName(noteNumber);

  // Encode the note as a single character
  const encodedNote = encodeNote(noteName);

  // Get current timestamp
  console.log(
    `[Piano] Note On received: ${noteName} (MIDI ${noteNumber}) -> encoded: ${encodedNote.charCodeAt(0).toString(16)}`,
  );

  // Inject the encoded note as text input
  const now = performance.now();
  void emulateInsertText({
    data: encodedNote,
    now,
  });
}

/**
 * Get all available MIDI input devices
 * @returns Array of MIDI input devices
 */
export function getMidiInputs(): MIDIInput[] {
  if (!midiAccess) return [];
  return Array.from(midiAccess.inputs.values());
}

/**
 * Get information about available MIDI devices (for UI display)
 */
export function getMidiDeviceInfo(): Array<{ id: string; name: string }> {
  const inputs = getMidiInputs();
  return inputs.map((input) => ({
    id: input.id,
    name: input.name ?? "Unknown Device",
  }));
}

/**
 * Switch to a different MIDI input device
 * @param deviceId - The ID of the device to switch to
 * @returns true if successful, false otherwise
 */
export function switchMidiDevice(deviceId: string): boolean {
  const device = getMidiInputById(deviceId);
  if (device !== null) {
    attachMidiListeners(device);
    return true;
  }
  return false;
}

/**
 * Clean up MIDI listeners and close access
 */
export function cleanupMidi(): void {
  if (activeInput && messageHandler) {
    activeInput.removeEventListener("midimessage", messageHandler);
    activeInput = null;
    messageHandler = null;
  }

  if (midiAccess) {
    // Close all inputs
    for (const input of midiAccess.inputs.values()) {
      void input.close();
    }
    midiAccess = null;
  }

  console.log("[Piano] MIDI cleanup complete");
}

/**
 * Check if MIDI is currently initialized and active
 */
export function isMidiActive(): boolean {
  return activeInput !== null && messageHandler !== null;
}
