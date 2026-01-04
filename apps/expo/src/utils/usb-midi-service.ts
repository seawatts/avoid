/**
 * USB MIDI Service
 *
 * This module re-exports the USB MIDI functionality from @seawatts/expo-usb-midi
 * which is an Expo native module that uses CoreMIDI on iOS.
 *
 * The native module provides:
 * - USB MIDI device detection via Camera Connection Kit
 * - MIDI message parsing (Note On/Off, Control Change)
 * - Hot-plug support (device connect/disconnect events)
 */

export {
  type UsbMidiControlChange,
  type UsbMidiControlChangeEvent,
  type UsbMidiDevice,
  type UsbMidiNote,
  type UsbMidiNoteEvent,
  useUsbMidi,
} from '@seawatts/expo-usb-midi';
