import { EventEmitter } from 'expo-modules-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type {
  UsbMidiControlChangeEvent,
  UsbMidiDevice,
  UsbMidiDeviceDisconnectedEvent,
  UsbMidiNoteEvent,
} from './expo-usb-midi.types';
import ExpoUsbMidiModule from './expo-usb-midi-module';

// Re-export types
export type {
  UsbMidiControlChangeEvent,
  UsbMidiDevice,
  UsbMidiEventMap,
  UsbMidiNoteEvent,
} from './expo-usb-midi.types';

// Check if module is available
const isModuleAvailable = Platform.OS === 'ios' && ExpoUsbMidiModule !== null;

// Create event emitter if module is available
// Type assertion needed because ExpoUsbMidiModule interface doesn't include EventEmitter methods
// but the native module implementation does support events
// Using 'any' type to work around TypeScript type definition issues with EventEmitter
// biome-ignore lint/suspicious/noExplicitAny: EventEmitter type system doesn't match our module interface
const emitter: any = isModuleAvailable
  ? // biome-ignore lint/suspicious/noExplicitAny: Native module type doesn't match EventEmitter constructor
    new EventEmitter(ExpoUsbMidiModule as any)
  : null;

export interface UsbMidiNote {
  note: number;
  velocity: number;
  channel: number;
  timestamp: number;
  type: 'noteOn' | 'noteOff';
}

export interface UsbMidiControlChange {
  channel: number;
  ccNumber: number;
  value: number;
  timestamp: number;
}

interface UsbMidiState {
  isListening: boolean;
  isAvailable: boolean;
  connectedDevices: UsbMidiDevice[];
  pressedKeys: Set<number>;
}

/**
 * Hook for USB MIDI device support on iOS
 *
 * @param onNoteEvent - Callback for note on/off events
 * @param onControlChange - Callback for control change events (sustain pedal, etc.)
 * @returns USB MIDI state and control functions
 */
export function useUsbMidi(
  onNoteEvent?: (note: UsbMidiNote) => void,
  onControlChange?: (cc: UsbMidiControlChange) => void,
) {
  // Store callbacks in refs to avoid re-initializing when they change
  const onNoteEventRef = useRef(onNoteEvent);
  const onControlChangeRef = useRef(onControlChange);

  // Update refs when callbacks change
  useEffect(() => {
    onNoteEventRef.current = onNoteEvent;
    onControlChangeRef.current = onControlChange;
  }, [onNoteEvent, onControlChange]);

  const [state, setState] = useState<UsbMidiState>({
    connectedDevices: [],
    isAvailable: isModuleAvailable,
    isListening: false,
    pressedKeys: new Set(),
  });

  const startListening = useCallback(async () => {
    if (!isModuleAvailable || !ExpoUsbMidiModule) {
      console.log('[USB MIDI] Cannot start listening - module not available');
      return;
    }

    try {
      console.log('[USB MIDI] Starting to listen for MIDI devices...');
      await ExpoUsbMidiModule.startListening();
      setState((prev) => ({ ...prev, isListening: true }));
      console.log('[USB MIDI] Successfully started listening');
    } catch (error) {
      console.error('[USB MIDI] Failed to start listening:', error);
    }
  }, []);

  const stopListening = useCallback(async () => {
    if (!isModuleAvailable || !ExpoUsbMidiModule) return;

    try {
      await ExpoUsbMidiModule.stopListening();
      setState((prev) => ({
        ...prev,
        isListening: false,
        pressedKeys: new Set(),
      }));
    } catch (error) {
      console.error('[USB MIDI] Failed to stop listening:', error);
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!isModuleAvailable || !ExpoUsbMidiModule) {
      console.log('[USB MIDI] Module not available');
      return;
    }

    try {
      console.log('[USB MIDI] Fetching connected devices...');
      const devices = await ExpoUsbMidiModule.getConnectedDevices();
      console.log('[USB MIDI] Found devices:', devices.length, devices);

      if (devices.length === 0) {
        console.warn('[USB MIDI] No devices found.');
        console.warn(
          '[USB MIDI] Make sure your MIDI device is connected via USB-C or Camera Connection Kit.',
        );
      }

      setState((prev) => ({ ...prev, connectedDevices: devices }));
    } catch (error) {
      console.error('[USB MIDI] Failed to get devices:', error);
    }
  }, []);

  // Initialize event listeners
  useEffect(() => {
    if (!isModuleAvailable || !emitter) {
      return;
    }

    const subscriptions: Array<{ remove: () => void }> = [];

    // Note On events
    subscriptions.push(
      emitter.addListener('onMidiNoteOn', (event: UsbMidiNoteEvent) => {
        const midiNote: UsbMidiNote = {
          channel: event.channel,
          note: event.note,
          timestamp: event.timestamp,
          type: 'noteOn',
          velocity: event.velocity,
        };

        setState((prev) => {
          const newPressedKeys = new Set(prev.pressedKeys);
          newPressedKeys.add(event.note);
          return { ...prev, pressedKeys: newPressedKeys };
        });

        onNoteEventRef.current?.(midiNote);
      }),
    );

    // Note Off events
    subscriptions.push(
      emitter.addListener('onMidiNoteOff', (event: UsbMidiNoteEvent) => {
        const midiNote: UsbMidiNote = {
          channel: event.channel,
          note: event.note,
          timestamp: event.timestamp,
          type: 'noteOff',
          velocity: event.velocity,
        };

        setState((prev) => {
          const newPressedKeys = new Set(prev.pressedKeys);
          newPressedKeys.delete(event.note);
          return { ...prev, pressedKeys: newPressedKeys };
        });

        onNoteEventRef.current?.(midiNote);
      }),
    );

    // Device connected events
    subscriptions.push(
      emitter.addListener('onMidiDeviceConnected', (device: UsbMidiDevice) => {
        console.log('[USB MIDI] Device connected:', device.name);
        setState((prev) => {
          const exists = prev.connectedDevices.some((d) => d.id === device.id);
          if (exists) return prev;
          return {
            ...prev,
            connectedDevices: [...prev.connectedDevices, device],
          };
        });
      }),
    );

    // Device disconnected events
    subscriptions.push(
      emitter.addListener(
        'onMidiDeviceDisconnected',
        (event: UsbMidiDeviceDisconnectedEvent) => {
          console.log('[USB MIDI] Device disconnected:', event.id);
          setState((prev) => ({
            ...prev,
            connectedDevices: prev.connectedDevices.filter(
              (d) => d.id !== event.id,
            ),
            pressedKeys: new Set(), // Clear pressed keys when device disconnects
          }));
        },
      ),
    );

    // Control Change events
    subscriptions.push(
      emitter.addListener(
        'onMidiControlChange',
        (event: UsbMidiControlChangeEvent) => {
          const cc: UsbMidiControlChange = {
            ccNumber: event.ccNumber,
            channel: event.channel,
            timestamp: event.timestamp,
            value: event.value,
          };
          onControlChangeRef.current?.(cc);
        },
      ),
    );

    // Start listening and get initial devices
    startListening();
    refreshDevices();

    return () => {
      subscriptions.forEach((sub) => {
        sub.remove();
      });
      stopListening();
    };
  }, [startListening, stopListening, refreshDevices]);

  return {
    ...state,
    refreshDevices,
    startListening,
    stopListening,
  };
}

// Export module for direct access if needed
export { ExpoUsbMidiModule };
