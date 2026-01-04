import { useFocusEffect, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CONTROLS_BAR_HEIGHT,
  WHITE_KEY_HEIGHT,
} from '~/components/piano/constants';

import { FallingNotesDisplay } from '~/components/piano/falling-notes-display';
import { PianoKeys } from '~/components/piano/piano-keys';
import { SynthesiaControls } from '~/components/piano/synthesia-controls';
import {
  type MidiControlChange,
  type MidiNote,
  useMidiService,
} from '~/utils/midi-service';
import { PIANO_KEYS, pianoAudio } from '~/utils/piano-audio';
import { getShowKeyNames } from '~/utils/piano-settings';
import { type PianoNote, pianoStorage } from '~/utils/piano-storage';
import {
  type UsbMidiControlChange,
  type UsbMidiNote,
  useUsbMidi,
} from '~/utils/usb-midi-service';
import { usePianoStore } from '../stores/piano-store';

export default function PianoScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const router = useRouter();

  // Zustand store state
  const isRecording = usePianoStore((state) => state.isRecording);
  const isPlaying = usePianoStore((state) => state.isPlaying);
  const recordedNotes = usePianoStore((state) => state.recordedNotes);
  const sustainEvents = usePianoStore((state) => state.sustainEvents);
  const showKeyNames = usePianoStore((state) => state.showKeyNames);
  const currentTime = usePianoStore((state) => state.currentTime);

  // Local state for frequently updated values
  const [activeNotes, setActiveNotes] = useState<Map<number, number>>(
    new Map(),
  );
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recordingName, setRecordingName] = useState('');

  // Preview mode state - keep note data in regular refs (not touched by Reanimated)
  const previewActiveNotes = useRef<Map<number, number>>(new Map());
  const previewCompletedNotes = useRef<Array<PianoNote & { id: string }>>([]);
  const previewNoteStartTimes = useRef<Map<number, number>>(new Map());
  const previewStartTime = useRef<number>(0);
  const previewNoteIdCounter = useRef<number>(0);
  // Shared values for Reanimated (animation runs on UI thread)
  const previewTimeShared = useSharedValue(0);
  const isPreviewAnimating = useSharedValue(false);
  // State to trigger re-renders when note data changes
  const [previewNoteVersion, setPreviewNoteVersion] = useState(0);

  // Store actions
  const startRecording = usePianoStore((state) => state.startRecording);
  const stopRecording = usePianoStore((state) => state.stopRecording);
  const addNote = usePianoStore((state) => state.addNote);
  const clearRecording = usePianoStore((state) => state.clearRecording);
  const startPlayback = usePianoStore((state) => state.startPlayback);
  const stopPlayback = usePianoStore((state) => state.stopPlayback);
  const setCurrentTime = usePianoStore((state) => state.setCurrentTime);
  const setShowKeyNames = usePianoStore((state) => state.setShowKeyNames);

  // Load show key names setting on mount and when screen is focused
  useFocusEffect(
    useCallback(() => {
      getShowKeyNames().then(setShowKeyNames);
    }, [setShowKeyNames]),
  );

  const recordingStartTime = useRef<number>(0);
  const playbackStartTime = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track note-on times for accurate duration calculation
  const noteOnTimes = useRef<Map<number, number>>(new Map());
  // Track sustain pedal state
  const sustainActive = useRef<boolean>(false);

  // Unified scroll view ref
  const unifiedScrollRef = useRef<ScrollView>(null);

  // Handle BLE MIDI control change (sustain pedal)
  const handleBleMidiControlChange = useCallback((cc: MidiControlChange) => {
    if (cc.ccNumber === 64) {
      const isActive = cc.value >= 64;
      sustainActive.current = isActive;
      // Sustain events are handled by the Zustand store
    }
  }, []);

  // Handle BLE MIDI note events
  const handleBleMidiNoteEvent = useCallback(
    (midiNote: MidiNote) => {
      const currentTimeMs = Date.now();

      if (midiNote.type === 'noteOn') {
        pianoAudio.playNote(midiNote.note);

        if (isRecording) {
          noteOnTimes.current.set(midiNote.note, currentTimeMs);
          setActiveNotes((prev) => {
            const newMap = new Map(prev);
            newMap.set(
              midiNote.note,
              currentTimeMs - recordingStartTime.current,
            );
            return newMap;
          });
        }
      } else if (midiNote.type === 'noteOff' && isRecording) {
        const noteOnTime = noteOnTimes.current.get(midiNote.note);
        const keyInfo = PIANO_KEYS.find((k) => k.midiNumber === midiNote.note);

        if (keyInfo && noteOnTime !== undefined) {
          const duration = currentTimeMs - noteOnTime;
          const note: PianoNote = {
            duration,
            midiNumber: midiNote.note,
            note: keyInfo.note,
            noteOffTime: currentTimeMs,
            noteOnTime,
            sustainActive: sustainActive.current,
            timestamp: noteOnTime - recordingStartTime.current,
          };
          addNote(note);
          noteOnTimes.current.delete(midiNote.note);
          setActiveNotes((prev) => {
            const newMap = new Map(prev);
            newMap.delete(midiNote.note);
            return newMap;
          });
        }
      }
    },
    [isRecording, addNote],
  );

  // Handle USB MIDI control change (sustain pedal)
  const handleUsbMidiControlChange = useCallback((cc: UsbMidiControlChange) => {
    if (cc.ccNumber === 64) {
      const isActive = cc.value >= 64;
      sustainActive.current = isActive;
      // Sustain events are handled by the Zustand store
    }
  }, []);

  // Handle USB MIDI note events
  const handleUsbMidiNoteEvent = useCallback(
    (midiNote: UsbMidiNote) => {
      const currentTimeMs = Date.now();

      if (midiNote.type === 'noteOn') {
        pianoAudio.playNote(midiNote.note);

        if (isRecording) {
          noteOnTimes.current.set(midiNote.note, currentTimeMs);
          setActiveNotes((prev) => {
            const newMap = new Map(prev);
            newMap.set(
              midiNote.note,
              currentTimeMs - recordingStartTime.current,
            );
            return newMap;
          });
        }
      } else if (midiNote.type === 'noteOff' && isRecording) {
        const noteOnTime = noteOnTimes.current.get(midiNote.note);
        const keyInfo = PIANO_KEYS.find((k) => k.midiNumber === midiNote.note);

        if (keyInfo && noteOnTime !== undefined) {
          const duration = currentTimeMs - noteOnTime;
          const note: PianoNote = {
            duration,
            midiNumber: midiNote.note,
            note: keyInfo.note,
            noteOffTime: currentTimeMs,
            noteOnTime,
            sustainActive: sustainActive.current,
            timestamp: noteOnTime - recordingStartTime.current,
          };
          addNote(note);
          noteOnTimes.current.delete(midiNote.note);
          setActiveNotes((prev) => {
            const newMap = new Map(prev);
            newMap.delete(midiNote.note);
            return newMap;
          });
        }
      }
    },
    [isRecording, addNote],
  );

  // Initialize MIDI services (BLE and USB)
  const bleMidi = useMidiService(
    handleBleMidiNoteEvent,
    handleBleMidiControlChange,
  );
  const usbMidi = useUsbMidi(
    handleUsbMidiNoteEvent,
    handleUsbMidiControlChange,
  );

  // Merge pressed keys from both MIDI sources
  const combinedPressedKeys = useMemo(() => {
    const combined = new Set<number>();
    for (const key of bleMidi.pressedKeys) {
      combined.add(key);
    }
    for (const key of usbMidi.pressedKeys) {
      combined.add(key);
    }
    return combined;
  }, [bleMidi.pressedKeys, usbMidi.pressedKeys]);

  // Calculate which notes are currently "landing" (playing) during playback
  // These are notes whose timestamp has been reached and duration hasn't expired
  const landingNotes = useMemo(() => {
    if (!isPlaying) return new Set<number>();

    const landing = new Set<number>();
    for (const note of recordedNotes) {
      const noteStartTime = note.timestamp;
      const noteEndTime = note.timestamp + note.duration;

      // Note is "landing" if current time is within the note's duration
      if (currentTime >= noteStartTime && currentTime <= noteEndTime) {
        landing.add(note.midiNumber);
      }
    }
    return landing;
  }, [isPlaying, recordedNotes, currentTime]);

  // Allow all orientations when on piano screen, lock back to portrait when leaving
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.unlockAsync();

      return () => {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        );
      };
    }, []),
  );

  // Timer management
  useEffect(() => {
    if (isRecording) {
      recordingStartTime.current = Date.now();
      setCurrentTime(0);

      timerIntervalRef.current = setInterval(() => {
        setCurrentTime(Date.now() - recordingStartTime.current);
      }, 50);
    } else if (isPlaying) {
      // Timer is managed by playback
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRecording, isPlaying, setCurrentTime]);

  const handleStartRecording = useCallback(() => {
    setActiveNotes(new Map());
    startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const handleStartPlayback = useCallback(async () => {
    if (recordedNotes.length === 0) return;

    startPlayback();

    // Start playback timer (16ms ≈ 60fps for smooth falling notes animation)
    timerIntervalRef.current = setInterval(() => {
      setCurrentTime(Date.now() - playbackStartTime.current);
    }, 16);

    // Play the sequence
    await pianoAudio.playSequence(recordedNotes, sustainEvents);

    // Playback finished
    stopPlayback();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, [
    recordedNotes,
    sustainEvents,
    startPlayback,
    stopPlayback,
    setCurrentTime,
  ]);

  const handleStopPlayback = useCallback(() => {
    stopPlayback();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, [stopPlayback]);

  const handleClearRecording = useCallback(() => {
    setActiveNotes(new Map());
    clearRecording();
  }, [clearRecording]);

  const handleSavePress = useCallback(() => {
    if (recordedNotes.length === 0) {
      Alert.alert('No Notes', 'Record some notes first before saving.');
      return;
    }
    setShowSaveModal(true);
  }, [recordedNotes.length]);

  const handleSaveConfirm = useCallback(async () => {
    const saved = await pianoStorage.saveRecording(
      recordingName,
      recordedNotes,
      sustainEvents,
    );
    if (saved) {
      setRecordingName('');
      setShowSaveModal(false);
      handleClearRecording();
      Alert.alert('Saved!', `Recording "${saved.name}" has been saved.`);
    } else {
      Alert.alert('Error', 'Failed to save recording.');
    }
  }, [recordingName, recordedNotes, sustainEvents, handleClearRecording]);

  const handleNotePlay = useCallback(
    (note: PianoNote) => {
      addNote(note);
    },
    [addNote],
  );

  // Animation loop for preview - updates shared value for smooth animation
  const previewAnimationId = useRef<number | null>(null);

  const runPreviewAnimation = useCallback(() => {
    const startTime = previewStartTime.current;
    if (startTime === 0) return;

    const updateTime = () => {
      if (!isPreviewAnimating.value) {
        previewAnimationId.current = null;
        return;
      }

      const currentTime = Date.now() - startTime;
      previewTimeShared.value = currentTime;

      // Clean up old notes periodically (every frame check, but only mutate when needed)
      const completed = previewCompletedNotes.current;
      if (completed.length > 0) {
        const filtered = completed.filter(
          (note) => currentTime - (note.timestamp + note.duration) < 10000,
        );
        if (filtered.length !== completed.length) {
          previewCompletedNotes.current = filtered;
          setPreviewNoteVersion((v) => v + 1);
        }
      }

      // Stop if no notes left
      if (
        previewActiveNotes.current.size === 0 &&
        previewCompletedNotes.current.length === 0
      ) {
        isPreviewAnimating.value = false;
        previewStartTime.current = 0;
        previewTimeShared.value = 0;
        previewAnimationId.current = null;
        return;
      }

      previewAnimationId.current = requestAnimationFrame(updateTime);
    };

    previewAnimationId.current = requestAnimationFrame(updateTime);
  }, [isPreviewAnimating, previewTimeShared]);

  const startPreviewAnimation = useCallback(() => {
    if (previewAnimationId.current !== null) return; // Already running
    isPreviewAnimating.value = true;
    runPreviewAnimation();
  }, [isPreviewAnimating, runPreviewAnimation]);

  const stopPreviewAnimation = useCallback(() => {
    // Cancel animation
    if (previewAnimationId.current !== null) {
      cancelAnimationFrame(previewAnimationId.current);
      previewAnimationId.current = null;
    }
    // Reset data
    previewActiveNotes.current = new Map();
    previewCompletedNotes.current = [];
    previewNoteStartTimes.current = new Map();
    previewStartTime.current = 0;
    previewNoteIdCounter.current = 0;
    isPreviewAnimating.value = false;
    previewTimeShared.value = 0;
    setPreviewNoteVersion(0);
  }, [isPreviewAnimating, previewTimeShared]);

  // Preview mode handlers (for when not recording)
  const handlePreviewNoteStart = useCallback(
    (midiNumber: number) => {
      // Only activate preview mode when not recording or playing
      if (isRecording || isPlaying) return;

      const now = Date.now();

      // Initialize if this is the first note
      if (previewStartTime.current === 0) {
        previewStartTime.current = now;
        previewNoteIdCounter.current = 0;
        previewActiveNotes.current.clear();
        previewCompletedNotes.current = [];
        previewNoteStartTimes.current.clear();
      }

      // Track start time
      const noteTimestamp = now - previewStartTime.current;
      previewNoteStartTimes.current.set(midiNumber, noteTimestamp);
      previewActiveNotes.current.set(midiNumber, noteTimestamp);

      // Start animation and trigger re-render for new active note
      startPreviewAnimation();
      setPreviewNoteVersion((v) => v + 1);
    },
    [isRecording, isPlaying, startPreviewAnimation],
  );

  const handlePreviewNoteEnd = useCallback(
    (midiNumber: number) => {
      // Only handle preview mode when not recording or playing
      if (isRecording || isPlaying) return;

      const startTimestamp = previewNoteStartTimes.current.get(midiNumber);

      if (startTimestamp !== undefined) {
        const now = Date.now();
        const currentTime = now - previewStartTime.current;
        const duration = Math.max(currentTime - startTimestamp, 50); // Minimum 50ms

        // Find key info for the note
        const keyInfo = PIANO_KEYS.find((k) => k.midiNumber === midiNumber);
        if (keyInfo) {
          previewNoteIdCounter.current += 1;

          // Limit max completed notes to prevent memory issues
          if (previewCompletedNotes.current.length >= 100) {
            previewCompletedNotes.current.shift(); // Remove oldest note
          }

          previewCompletedNotes.current.push({
            duration,
            id: `${midiNumber}-${previewNoteIdCounter.current}`,
            midiNumber,
            note: keyInfo.note,
            noteOffTime: now,
            noteOnTime: now - duration,
            timestamp: startTimestamp,
          });
        }

        previewNoteStartTimes.current.delete(midiNumber);
      }

      previewActiveNotes.current.delete(midiNumber);
      // Trigger re-render for note changes
      setPreviewNoteVersion((v) => v + 1);
    },
    [isRecording, isPlaying],
  );

  // Stop preview animation when recording or playing starts
  useEffect(() => {
    if (isRecording || isPlaying) {
      stopPreviewAnimation();
    }
  }, [isRecording, isPlaying, stopPreviewAnimation]);

  // Calculate falling notes display height
  const keyboardHeight = isLandscape
    ? WHITE_KEY_HEIGHT * 0.8
    : WHITE_KEY_HEIGHT;
  const fallingNotesHeight = height - CONTROLS_BAR_HEIGHT - keyboardHeight - 40; // 40 for safe area padding

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      {/* Top Controls Bar */}
      <SynthesiaControls
        currentTime={currentTime}
        hasRecordedNotes={recordedNotes.length > 0}
        isPlaying={isPlaying}
        isRecording={isRecording}
        onClear={handleClearRecording}
        onClose={() => router.back()}
        onSave={handleSavePress}
        onStartPlayback={handleStartPlayback}
        onStartRecording={handleStartRecording}
        onStopPlayback={handleStopPlayback}
        onStopRecording={handleStopRecording}
      />

      {/* Unified Scroll View for Falling Notes and Piano Keys */}
      <View style={styles.unifiedContainer}>
        <ScrollView
          horizontal
          ref={unifiedScrollRef}
          showsHorizontalScrollIndicator={false}
          style={styles.unifiedScrollView}
        >
          {/* Vertical stack of falling notes and piano keys */}
          <View style={styles.verticalStack}>
            {/* Falling Notes Display */}
            <View
              style={[
                styles.fallingNotesInScroll,
                { height: fallingNotesHeight },
              ]}
            >
              <FallingNotesDisplay
                activeNotes={activeNotes}
                currentTime={currentTime}
                displayHeight={fallingNotesHeight}
                isPlaying={isPlaying}
                isPreviewing={
                  previewActiveNotes.current.size > 0 ||
                  previewCompletedNotes.current.length > 0
                }
                isRecording={isRecording}
                notes={recordedNotes}
                previewActiveNotes={previewActiveNotes.current}
                previewCompletedNotes={previewCompletedNotes.current}
                previewDataVersion={previewNoteVersion}
                previewTimeShared={previewTimeShared}
              />
            </View>

            {/* Piano Keyboard */}
            <View
              style={[
                styles.keyboardInScroll,
                isLandscape && styles.keyboardLandscape,
              ]}
            >
              <PianoKeys
                externalPressedKeys={combinedPressedKeys}
                isRecording={isRecording}
                landingNotes={landingNotes}
                onNoteEnd={handlePreviewNoteEnd}
                onNotePlay={handleNotePlay}
                onNoteStart={handlePreviewNoteStart}
                showKeyNames={showKeyNames}
              />
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Save Modal */}
      <Modal
        animationType="fade"
        onRequestClose={() => {
          setShowSaveModal(false);
          setRecordingName('');
        }}
        transparent
        visible={showSaveModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.saveModal}>
            <Text style={styles.saveTitle}>Save Recording</Text>
            <Text style={styles.saveSubtitle}>
              {recordedNotes.length} notes
            </Text>
            <TextInput
              autoFocus
              onChangeText={setRecordingName}
              placeholder="Enter a name..."
              placeholderTextColor="#A1A1AA"
              style={styles.saveInput}
              value={recordingName}
            />
            <View style={styles.saveActions}>
              <Pressable
                onPress={() => {
                  setShowSaveModal(false);
                  setRecordingName('');
                }}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={!recordingName.trim()}
                onPress={handleSaveConfirm}
                style={[
                  styles.confirmButton,
                  !recordingName.trim() && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.confirmButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#3A3A3C',
    borderRadius: 10,
    flex: 1,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#4ADE80',
    borderRadius: 10,
    flex: 1,
    paddingVertical: 12,
  },
  confirmButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    backgroundColor: '#1C1C1E',
    flex: 1,
  },
  fallingNotesInScroll: {
    backgroundColor: '#2D2D2D',
    paddingHorizontal: 4,
  },
  keyboardInScroll: {
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  keyboardLandscape: {
    paddingHorizontal: 8,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flex: 1,
    justifyContent: 'center',
  },
  saveActions: {
    flexDirection: 'row',
    gap: 12,
  },
  saveInput: {
    backgroundColor: '#3A3A3C',
    borderRadius: 10,
    color: '#FAFAFA',
    fontSize: 16,
    padding: 12,
  },
  saveModal: {
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    gap: 16,
    marginHorizontal: 24,
    padding: 20,
    width: '85%',
  },
  saveSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
  },
  saveTitle: {
    color: '#FAFAFA',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  unifiedContainer: {
    flex: 1,
  },
  unifiedScrollView: {
    flex: 1,
  },
  verticalStack: {
    flexDirection: 'column',
  },
});
