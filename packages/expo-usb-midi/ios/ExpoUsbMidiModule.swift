import ExpoModulesCore
import CoreMIDI

public class ExpoUsbMidiModule: Module {
    private var midiClient: MIDIClientRef = 0
    private var inputPort: MIDIPortRef = 0
    private var isListening: Bool = false
    private var connectedSources: [MIDIEndpointRef: Int] = [:]
    private var nextDeviceId: Int = 1

    public func definition() -> ModuleDefinition {
        Name("ExpoUsbMidi")

        Events(
            "onMidiDeviceConnected",
            "onMidiDeviceDisconnected",
            "onMidiNoteOn",
            "onMidiNoteOff",
            "onMidiControlChange",
            "onMidiPacketReceived"
        )

        OnCreate {
            print("[ExpoUsbMidi] Module created")
        }

        OnDestroy {
            self.cleanup()
        }

        AsyncFunction("startListening") { () -> Void in
            try self.startListening()
        }

        AsyncFunction("stopListening") { () -> Void in
            self.stopListening()
        }

        AsyncFunction("getConnectedDevices") { () -> [[String: Any]] in
            return self.getConnectedDevices()
        }
    }

    // MARK: - MIDI Client Setup

    private func startListening() throws {
        guard !isListening else {
            print("[ExpoUsbMidi] Already listening")
            return
        }

        print("[ExpoUsbMidi] Starting MIDI listener...")

        // Create MIDI client with notification callback
        let clientName = "ExpoUsbMidiClient" as CFString
        let clientStatus = MIDIClientCreateWithBlock(clientName, &midiClient) { [weak self] notification in
            self?.handleMIDINotification(notification)
        }

        guard clientStatus == noErr else {
            print("[ExpoUsbMidi] Failed to create MIDI client: \(clientStatus)")
            throw MidiError.clientCreationFailed
        }

        print("[ExpoUsbMidi] MIDI client created successfully")

        // Create input port with protocol-based callback (iOS 14+)
        let portName = "ExpoUsbMidiInput" as CFString
        let portStatus = MIDIInputPortCreateWithProtocol(
            midiClient,
            portName,
            MIDIProtocolID._1_0,
            &inputPort
        ) { [weak self] eventList, srcConnRefCon in
            self?.handleMIDIEventList(eventList, srcConnRefCon: srcConnRefCon)
        }

        guard portStatus == noErr else {
            print("[ExpoUsbMidi] Failed to create input port: \(portStatus)")
            MIDIClientDispose(midiClient)
            midiClient = 0
            throw MidiError.inputPortCreationFailed
        }

        print("[ExpoUsbMidi] Input port created successfully")

        isListening = true

        // Connect to all existing sources
        connectToAllSources()

        print("[ExpoUsbMidi] MIDI listener started successfully")
    }

    private func stopListening() {
        guard isListening else { return }

        print("[ExpoUsbMidi] Stopping MIDI listener...")
        cleanup()
        print("[ExpoUsbMidi] MIDI listener stopped")
    }

    private func cleanup() {
        // Disconnect from all sources
        for (source, _) in connectedSources {
            MIDIPortDisconnectSource(inputPort, source)
        }
        connectedSources.removeAll()

        // Dispose of MIDI resources
        if inputPort != 0 {
            MIDIPortDispose(inputPort)
            inputPort = 0
        }

        if midiClient != 0 {
            MIDIClientDispose(midiClient)
            midiClient = 0
        }

        isListening = false
    }

    // MARK: - Device Discovery

    private func connectToAllSources() {
        let sourceCount = MIDIGetNumberOfSources()
        print("[ExpoUsbMidi] Found \(sourceCount) MIDI sources")

        for i in 0..<sourceCount {
            let source = MIDIGetSource(i)
            connectToSource(source)
        }
    }

    private func connectToSource(_ source: MIDIEndpointRef) {
        guard source != 0 else { return }
        guard connectedSources[source] == nil else { return }

        let deviceId = nextDeviceId
        nextDeviceId += 1

        let status = MIDIPortConnectSource(inputPort, source, UnsafeMutableRawPointer(bitPattern: deviceId))

        if status == noErr {
            connectedSources[source] = deviceId

            let deviceInfo = getDeviceInfo(for: source, deviceId: deviceId)
            print("[ExpoUsbMidi] Connected to source: \(deviceInfo["name"] ?? "Unknown")")

            sendEvent("onMidiDeviceConnected", deviceInfo)
        } else {
            print("[ExpoUsbMidi] Failed to connect to source: \(status)")
        }
    }

    private func disconnectFromSource(_ source: MIDIEndpointRef) {
        guard let deviceId = connectedSources[source] else { return }

        MIDIPortDisconnectSource(inputPort, source)
        connectedSources.removeValue(forKey: source)

        print("[ExpoUsbMidi] Disconnected from device \(deviceId)")
        sendEvent("onMidiDeviceDisconnected", ["id": deviceId])
    }

    private func getConnectedDevices() -> [[String: Any]] {
        var devices: [[String: Any]] = []

        for (source, deviceId) in connectedSources {
            let deviceInfo = getDeviceInfo(for: source, deviceId: deviceId)
            devices.append(deviceInfo)
        }

        return devices
    }

    private func getDeviceInfo(for endpoint: MIDIEndpointRef, deviceId: Int) -> [String: Any] {
        var name: Unmanaged<CFString>?
        var manufacturer: Unmanaged<CFString>?
        var model: Unmanaged<CFString>?

        MIDIObjectGetStringProperty(endpoint, kMIDIPropertyName, &name)
        MIDIObjectGetStringProperty(endpoint, kMIDIPropertyManufacturer, &manufacturer)
        MIDIObjectGetStringProperty(endpoint, kMIDIPropertyModel, &model)

        return [
            "id": deviceId,
            "name": (name?.takeRetainedValue() as String?) ?? "Unknown Device",
            "manufacturer": (manufacturer?.takeRetainedValue() as String?) ?? "Unknown",
            "model": (model?.takeRetainedValue() as String?) ?? "Unknown"
        ]
    }

    // MARK: - MIDI Notification Handling

    private func handleMIDINotification(_ notification: UnsafePointer<MIDINotification>) {
        let messageID = notification.pointee.messageID

        switch messageID {
        case .msgObjectAdded:
            print("[ExpoUsbMidi] MIDI object added")
            let addedNotification = UnsafeRawPointer(notification).assumingMemoryBound(to: MIDIObjectAddRemoveNotification.self)
            let childType = addedNotification.pointee.childType

            if childType == .source {
                let source = addedNotification.pointee.child
                connectToSource(source)
            }

        case .msgObjectRemoved:
            print("[ExpoUsbMidi] MIDI object removed")
            let removedNotification = UnsafeRawPointer(notification).assumingMemoryBound(to: MIDIObjectAddRemoveNotification.self)
            let childType = removedNotification.pointee.childType

            if childType == .source {
                let source = removedNotification.pointee.child
                disconnectFromSource(source)
            }

        case .msgSetupChanged:
            print("[ExpoUsbMidi] MIDI setup changed")
            // Rescan for devices
            refreshConnections()

        default:
            break
        }
    }

    private func refreshConnections() {
        // Check for new sources
        let sourceCount = MIDIGetNumberOfSources()
        var currentSources: Set<MIDIEndpointRef> = []

        for i in 0..<sourceCount {
            let source = MIDIGetSource(i)
            currentSources.insert(source)

            if connectedSources[source] == nil {
                connectToSource(source)
            }
        }

        // Check for removed sources
        for (source, _) in connectedSources {
            if !currentSources.contains(source) {
                disconnectFromSource(source)
            }
        }
    }

    // MARK: - MIDI Event Handling

    private func handleMIDIEventList(_ eventList: UnsafePointer<MIDIEventList>, srcConnRefCon: UnsafeMutableRawPointer?) {
        let timestamp = Date().timeIntervalSince1970 * 1000 // milliseconds

        var packetCount = 0

        // Iterate through all events in the event list
        var packet = eventList.pointee.packet
        for _ in 0..<eventList.pointee.numPackets {
            packetCount += 1

            // Process this packet's words
            withUnsafePointer(to: &packet.words) { wordsPtr in
                let wordCount = Int(packet.wordCount)
                let words = wordsPtr.withMemoryRebound(to: UInt32.self, capacity: wordCount) { ptr in
                    Array(UnsafeBufferPointer(start: ptr, count: wordCount))
                }

                for word in words {
                    processUniversalMIDIPacket(word: word, timestamp: timestamp)
                }
            }

            // Move to next packet (MIDIEventPacket has variable size)
            packet = MIDIEventPacketNext(&packet).pointee
        }

        if packetCount > 0 {
            sendEvent("onMidiPacketReceived", ["packetCount": packetCount])
        }
    }

    private func processUniversalMIDIPacket(word: UInt32, timestamp: Double) {
        // Parse Universal MIDI Packet (UMP)
        let messageType = (word >> 28) & 0x0F

        // Message Type 0x2 = MIDI 1.0 Channel Voice Message
        if messageType == 0x2 {
            let status = UInt8((word >> 16) & 0xFF)
            let data1 = UInt8((word >> 8) & 0xFF)
            let data2 = UInt8(word & 0xFF)

            let statusType = status & 0xF0
            let channel = Int(status & 0x0F)

            switch statusType {
            case 0x90: // Note On
                if data2 > 0 {
                    sendEvent("onMidiNoteOn", [
                        "note": Int(data1),
                        "velocity": Int(data2),
                        "channel": channel,
                        "timestamp": timestamp
                    ])
                } else {
                    // Note On with velocity 0 is treated as Note Off
                    sendEvent("onMidiNoteOff", [
                        "note": Int(data1),
                        "velocity": 0,
                        "channel": channel,
                        "timestamp": timestamp
                    ])
                }

            case 0x80: // Note Off
                sendEvent("onMidiNoteOff", [
                    "note": Int(data1),
                    "velocity": Int(data2),
                    "channel": channel,
                    "timestamp": timestamp
                ])

            case 0xB0: // Control Change
                sendEvent("onMidiControlChange", [
                    "ccNumber": Int(data1),
                    "value": Int(data2),
                    "channel": channel,
                    "timestamp": timestamp
                ])

            default:
                break
            }
        }
    }
}

// MARK: - Error Types

enum MidiError: Error {
    case clientCreationFailed
    case inputPortCreationFailed
}
