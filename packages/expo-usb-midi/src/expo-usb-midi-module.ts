import { requireNativeModule } from 'expo-modules-core';

import type { UsbMidiDevice } from './expo-usb-midi.types';

interface ExpoUsbMidiModuleInterface {
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  getConnectedDevices(): Promise<UsbMidiDevice[]>;
}

// This will throw an error if the native module is not available
// which is expected on non-iOS platforms or in Expo Go
let ExpoUsbMidiModule: ExpoUsbMidiModuleInterface | null = null;

try {
  ExpoUsbMidiModule = requireNativeModule('ExpoUsbMidi');
} catch {
  // Native module not available - this is expected on Android or in Expo Go
  console.warn(
    '[ExpoUsbMidi] Native module not available. USB MIDI will be disabled.',
  );
}

export default ExpoUsbMidiModule;
