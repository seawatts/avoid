export interface UsbMidiDevice {
  id: number;
  name: string;
  manufacturer: string;
  model: string;
}

export interface UsbMidiNoteEvent {
  note: number;
  velocity: number;
  channel: number;
  timestamp: number;
}

export interface UsbMidiControlChangeEvent {
  ccNumber: number;
  value: number;
  channel: number;
  timestamp: number;
}

export interface UsbMidiPacketEvent {
  packetCount: number;
}

export interface UsbMidiDeviceDisconnectedEvent {
  id: number;
}

export type UsbMidiEventMap = {
  onMidiDeviceConnected: UsbMidiDevice;
  onMidiDeviceDisconnected: UsbMidiDeviceDisconnectedEvent;
  onMidiNoteOn: UsbMidiNoteEvent;
  onMidiNoteOff: UsbMidiNoteEvent;
  onMidiControlChange: UsbMidiControlChangeEvent;
  onMidiPacketReceived: UsbMidiPacketEvent;
};
