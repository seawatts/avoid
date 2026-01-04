import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, { G, Line, Rect } from 'react-native-svg';

import { PIANO_KEYS } from '~/utils/piano-audio';
import type { PianoNote } from '~/utils/piano-storage';

import {
  GRID_BACKGROUND,
  GRID_LINE_COLOR,
  getMidiNoteXPosition,
  getNoteWidth,
  HIT_LINE_OFFSET,
  KEY_GAP,
  MIN_NOTE_HEIGHT,
  NOTE_BORDER_RADIUS,
  NOTE_COLOR,
  NOTE_COLOR_ACTIVE,
  PIXELS_PER_SECOND,
  WHITE_KEY_WIDTH,
} from './constants';

// Create animated Rect component
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface FallingNotesDisplayProps {
  notes: PianoNote[];
  activeNotes: Map<number, number>; // midiNumber -> timestamp when note started
  isRecording: boolean;
  isPlaying: boolean;
  isPreviewing?: boolean; // Preview mode (showing notes when not recording)
  currentTime: number; // Current time in ms (relative to start)
  displayHeight: number; // Height of the display area
  previewActiveNotes?: Map<number, number>; // Preview notes (midiNumber -> start timestamp)
  previewCompletedNotes?: Array<PianoNote & { id: string }>; // Completed preview notes that animate upward
  previewDataVersion?: number; // Version number to force useMemo recalculation when data changes
  previewTimeShared?: SharedValue<number>; // Shared value for preview time (animated on UI thread)
}

// Animated preview note component for active notes (growing)
interface AnimatedActivePreviewNoteProps {
  midiNumber: number;
  startTimestamp: number;
  x: number;
  width: number;
  isBlackKey: boolean;
  hitLineY: number;
  previewTimeShared: SharedValue<number>;
}

const AnimatedActivePreviewNote = React.memo(
  function AnimatedActivePreviewNote({
    midiNumber,
    startTimestamp,
    x,
    width,
    isBlackKey,
    hitLineY,
    previewTimeShared,
  }: AnimatedActivePreviewNoteProps) {
    const animatedProps = useAnimatedProps(() => {
      'worklet';
      const duration = previewTimeShared.value - startTimestamp;
      const height = Math.max(
        (duration / 1000) * PIXELS_PER_SECOND,
        MIN_NOTE_HEIGHT,
      );
      const y = hitLineY - height;

      return {
        height,
        y,
      };
    });

    return (
      <AnimatedRect
        animatedProps={animatedProps}
        fill={NOTE_COLOR_ACTIVE}
        key={`preview-active-${midiNumber}`}
        opacity={isBlackKey ? 0.85 : 1}
        rx={NOTE_BORDER_RADIUS}
        width={width - (isBlackKey ? 0 : KEY_GAP)}
        x={x + (isBlackKey ? 0 : KEY_GAP / 2)}
      />
    );
  },
);

// Animated preview note component for completed notes (scrolling up)
interface AnimatedCompletedPreviewNoteProps {
  note: PianoNote & { id: string };
  x: number;
  width: number;
  isBlackKey: boolean;
  hitLineY: number;
  previewTimeShared: SharedValue<number>;
}

const AnimatedCompletedPreviewNote = React.memo(
  function AnimatedCompletedPreviewNote({
    note,
    x,
    width,
    isBlackKey,
    hitLineY,
    previewTimeShared,
  }: AnimatedCompletedPreviewNoteProps) {
    const height = Math.max(
      (note.duration / 1000) * PIXELS_PER_SECOND,
      MIN_NOTE_HEIGHT,
    );

    const animatedProps = useAnimatedProps(() => {
      'worklet';
      // Time since note ended (not started) to avoid position jump
      const timeSinceEnd =
        previewTimeShared.value - (note.timestamp + note.duration);
      const y = hitLineY - height - (timeSinceEnd / 1000) * PIXELS_PER_SECOND;

      return {
        y,
      };
    });

    return (
      <AnimatedRect
        animatedProps={animatedProps}
        fill={NOTE_COLOR}
        height={height}
        key={`preview-${note.id}`}
        opacity={isBlackKey ? 0.85 : 1}
        rx={NOTE_BORDER_RADIUS}
        width={width - (isBlackKey ? 0 : KEY_GAP)}
        x={x + (isBlackKey ? 0 : KEY_GAP / 2)}
      />
    );
  },
);

export const FallingNotesDisplay = React.memo(function FallingNotesDisplay({
  notes,
  activeNotes,
  isRecording,
  isPlaying,
  isPreviewing = false,
  currentTime,
  displayHeight,
  previewActiveNotes,
  previewCompletedNotes = [],
  previewDataVersion = 0,
  previewTimeShared,
}: FallingNotesDisplayProps) {
  // Show all 88 keys (full piano range: A0 to C8)
  const visibleKeys = useMemo(() => {
    return PIANO_KEYS.filter(
      (key) => key.midiNumber >= 21 && key.midiNumber <= 108,
    );
  }, []);

  // Sort keys from low to high
  const sortedKeys = useMemo(() => {
    return [...visibleKeys].sort((a, b) => a.midiNumber - b.midiNumber);
  }, [visibleKeys]);

  // Create white key index map for positioning
  const whiteKeyIndices = useMemo(() => {
    const indices = new Map<number, number>();
    let whiteIndex = 0;
    for (const key of sortedKeys) {
      if (!key.isBlackKey) {
        indices.set(key.midiNumber, whiteIndex);
        whiteIndex++;
      }
    }
    return indices;
  }, [sortedKeys]);

  // Calculate total width based on white keys only (same as keyboard)
  const whiteKeyCount = sortedKeys.filter((k) => !k.isBlackKey).length;
  const totalWidth = whiteKeyCount * (WHITE_KEY_WIDTH + KEY_GAP) - KEY_GAP;

  // Time window: how many ms of notes to show on screen
  const timeWindowMs = (displayHeight / PIXELS_PER_SECOND) * 1000;

  // Calculate visible notes based on current time and mode
  const visibleNotes = useMemo(() => {
    if (isRecording) {
      // In recording mode, show notes that have been played
      // Notes rise up from the hit line
      return notes.filter((note) => {
        const noteEndTime = note.timestamp + note.duration;
        // Show notes that started within the visible time window
        return (
          note.timestamp <= currentTime &&
          noteEndTime >= currentTime - timeWindowMs
        );
      });
    }

    if (isPlaying) {
      // In playback mode, notes fall from top
      // Show all notes that haven't been played yet, plus notes currently playing
      return notes.filter((note) => {
        const noteEndTime = note.timestamp + note.duration;
        // Show notes that will play in the future or are currently playing
        return (
          note.timestamp >= currentTime - 100 || noteEndTime >= currentTime
        );
      });
    }

    // Not recording or playing - show all recorded notes statically
    return notes;
  }, [notes, currentTime, isRecording, isPlaying, timeWindowMs]);

  // Hit line Y position (near the bottom)
  const hitLineY = displayHeight - HIT_LINE_OFFSET;

  // Calculate note rectangles
  const noteRects = useMemo(() => {
    return visibleNotes
      .map((note) => {
        const keyInfo = sortedKeys.find(
          (k) => k.midiNumber === note.midiNumber,
        );
        if (!keyInfo) return null;

        const isBlackKey = keyInfo.isBlackKey;
        const noteName = keyInfo.note.replace(/\d+$/, '');

        // Get X position
        const x = getMidiNoteXPosition(
          note.midiNumber,
          whiteKeyIndices,
          isBlackKey,
          noteName,
        );

        // Get width
        const width = getNoteWidth(isBlackKey);

        // Calculate height based on duration
        const height = Math.max(
          (note.duration / 1000) * PIXELS_PER_SECOND,
          MIN_NOTE_HEIGHT,
        );

        // Calculate Y position based on mode
        let y: number;
        if (isRecording) {
          // Notes rise up from hit line
          // Newer notes are at the bottom, older notes scroll up
          const timeSinceStart = currentTime - note.timestamp;
          y = hitLineY - height - (timeSinceStart / 1000) * PIXELS_PER_SECOND;
        } else if (isPlaying) {
          // Notes fall down from top to hit line
          const timeUntilHit = note.timestamp - currentTime;

          if (timeUntilHit <= 0) {
            // Note is at or past hit time - position at hit line
            y = hitLineY - height;
          } else {
            // Note is falling - position above hit line based on time until hit
            const pixelsAboveHitLine =
              (timeUntilHit / 1000) * PIXELS_PER_SECOND;
            y = hitLineY - height - pixelsAboveHitLine;

            // Ensure note doesn't go above the visible area
            y = Math.max(y, -height);
          }
        } else {
          // Static display - stack notes from bottom
          y = hitLineY - height - (note.timestamp / 1000) * PIXELS_PER_SECOND;
        }

        // Check if note is currently active (being played)
        const isActive = activeNotes.has(note.midiNumber);

        return {
          height,
          isActive,
          isBlackKey,
          key: `${note.midiNumber}-${note.timestamp}`,
          width,
          x,
          y,
        };
      })
      .filter((rect): rect is NonNullable<typeof rect> => rect !== null);
  }, [
    visibleNotes,
    sortedKeys,
    whiteKeyIndices,
    currentTime,
    isRecording,
    isPlaying,
    hitLineY,
    activeNotes,
  ]);

  // Calculate active note rectangles (notes currently being held during recording)
  const activeNoteRects = useMemo(() => {
    if (!isRecording) return [];

    return Array.from(activeNotes.entries())
      .map(([midiNumber, startTimestamp]) => {
        const keyInfo = sortedKeys.find((k) => k.midiNumber === midiNumber);
        if (!keyInfo) return null;

        const isBlackKey = keyInfo.isBlackKey;
        const noteName = keyInfo.note.replace(/\d+$/, '');

        const x = getMidiNoteXPosition(
          midiNumber,
          whiteKeyIndices,
          isBlackKey,
          noteName,
        );

        const width = getNoteWidth(isBlackKey);

        // Active notes grow from hit line upward
        const duration = currentTime - startTimestamp;
        const height = Math.max(
          (duration / 1000) * PIXELS_PER_SECOND,
          MIN_NOTE_HEIGHT,
        );

        // Position at hit line, growing upward
        const y = hitLineY - height;

        return {
          height,
          isActive: true,
          isBlackKey,
          key: `active-${midiNumber}`,
          width,
          x,
          y,
        };
      })
      .filter((rect): rect is NonNullable<typeof rect> => rect !== null);
  }, [
    activeNotes,
    sortedKeys,
    whiteKeyIndices,
    currentTime,
    isRecording,
    hitLineY,
  ]);

  // Prepare preview active note data (static props, animated via shared value)
  const previewActiveNoteData = useMemo(() => {
    if (!isPreviewing || !previewActiveNotes || !previewTimeShared) return [];

    return Array.from(previewActiveNotes.entries())
      .map(([midiNumber, startTimestamp]) => {
        const keyInfo = sortedKeys.find((k) => k.midiNumber === midiNumber);
        if (!keyInfo) return null;

        const isBlackKey = keyInfo.isBlackKey;
        const noteName = keyInfo.note.replace(/\d+$/, '');

        const x = getMidiNoteXPosition(
          midiNumber,
          whiteKeyIndices,
          isBlackKey,
          noteName,
        );

        const width = getNoteWidth(isBlackKey);

        return {
          isBlackKey,
          midiNumber,
          startTimestamp,
          width,
          x,
        };
      })
      .filter((data): data is NonNullable<typeof data> => data !== null);
  }, [
    isPreviewing,
    previewActiveNotes,
    previewDataVersion,
    previewTimeShared,
    sortedKeys,
    whiteKeyIndices,
  ]);

  // Prepare preview completed note data (static props, animated via shared value)
  const previewCompletedNoteData = useMemo(() => {
    if (
      !isPreviewing ||
      previewCompletedNotes.length === 0 ||
      !previewTimeShared
    )
      return [];

    return previewCompletedNotes
      .map((note) => {
        const keyInfo = sortedKeys.find(
          (k) => k.midiNumber === note.midiNumber,
        );
        if (!keyInfo) return null;

        const isBlackKey = keyInfo.isBlackKey;
        const noteName = keyInfo.note.replace(/\d+$/, '');

        const x = getMidiNoteXPosition(
          note.midiNumber,
          whiteKeyIndices,
          isBlackKey,
          noteName,
        );

        const width = getNoteWidth(isBlackKey);

        return {
          isBlackKey,
          note,
          width,
          x,
        };
      })
      .filter((data): data is NonNullable<typeof data> => data !== null);
  }, [
    isPreviewing,
    previewCompletedNotes,
    previewDataVersion,
    previewTimeShared,
    sortedKeys,
    whiteKeyIndices,
  ]);

  // Grid lines for visual alignment
  const gridLines = useMemo(() => {
    const lines: Array<{ x: number; key: string }> = [];
    let whiteIndex = 0;

    for (const key of sortedKeys) {
      if (!key.isBlackKey) {
        const x = whiteIndex * (WHITE_KEY_WIDTH + KEY_GAP);
        lines.push({ key: `grid-${key.midiNumber}`, x });
        whiteIndex++;
      }
    }

    // Add final line at the end
    lines.push({ key: 'grid-end', x: totalWidth });

    return lines;
  }, [sortedKeys, totalWidth]);

  return (
    <Svg height={displayHeight} style={styles.svg} width={totalWidth}>
      {/* Background */}
      <Rect
        fill={GRID_BACKGROUND}
        height={displayHeight}
        width={totalWidth}
        x={0}
        y={0}
      />

      {/* Grid lines */}
      <G>
        {gridLines.map((line) => (
          <Line
            key={line.key}
            stroke={GRID_LINE_COLOR}
            strokeWidth={1}
            x1={line.x}
            x2={line.x}
            y1={0}
            y2={displayHeight}
          />
        ))}
      </G>

      {/* Recorded notes */}
      <G>
        {noteRects.map((rect) => (
          <Rect
            fill={rect.isActive ? NOTE_COLOR_ACTIVE : NOTE_COLOR}
            height={rect.height}
            key={rect.key}
            opacity={rect.isBlackKey ? 0.85 : 1}
            rx={NOTE_BORDER_RADIUS}
            width={rect.width - (rect.isBlackKey ? 0 : KEY_GAP)}
            x={rect.x + (rect.isBlackKey ? 0 : KEY_GAP / 2)}
            y={rect.y}
          />
        ))}
      </G>

      {/* Active notes (currently being held during recording) */}
      <G>
        {activeNoteRects.map((rect) => (
          <Rect
            fill={NOTE_COLOR_ACTIVE}
            height={rect.height}
            key={rect.key}
            opacity={rect.isBlackKey ? 0.85 : 1}
            rx={NOTE_BORDER_RADIUS}
            width={rect.width - (rect.isBlackKey ? 0 : KEY_GAP)}
            x={rect.x + (rect.isBlackKey ? 0 : KEY_GAP / 2)}
            y={rect.y}
          />
        ))}
      </G>

      {/* Preview completed notes (animated via shared value) */}
      <G>
        {previewTimeShared &&
          previewCompletedNoteData.map((data) => (
            <AnimatedCompletedPreviewNote
              hitLineY={hitLineY}
              isBlackKey={data.isBlackKey}
              key={`preview-${data.note.id}`}
              note={data.note}
              previewTimeShared={previewTimeShared}
              width={data.width}
              x={data.x}
            />
          ))}
      </G>

      {/* Preview active notes (animated via shared value) */}
      <G>
        {previewTimeShared &&
          previewActiveNoteData.map((data) => (
            <AnimatedActivePreviewNote
              hitLineY={hitLineY}
              isBlackKey={data.isBlackKey}
              key={`preview-active-${data.midiNumber}`}
              midiNumber={data.midiNumber}
              previewTimeShared={previewTimeShared}
              startTimestamp={data.startTimestamp}
              width={data.width}
              x={data.x}
            />
          ))}
      </G>
    </Svg>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: GRID_BACKGROUND,
    overflow: 'hidden',
  },
  svg: {
    flex: 1,
  },
});

export { WHITE_KEY_WIDTH, KEY_GAP };
