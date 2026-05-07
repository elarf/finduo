import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { FinGoAsset, UsageEntry } from '../../types/fingo';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

type Props = {
  visible: boolean;
  asset: FinGoAsset | null;
  onClose: () => void;
  onSubmit: (entry: UsageEntry) => Promise<void>;
};

function parseNum(v: string): number {
  return parseFloat(v.replace(',', '.')) || 0;
}

/** Convert "h:mm" or bare number string to minutes */
function parseTime(v: string): number {
  const trimmed = v.trim();
  if (trimmed.includes(':')) {
    const [h, m] = trimmed.split(':').map((s) => parseInt(s, 10) || 0);
    return h * 60 + m;
  }
  const n = parseFloat(trimmed) || 0;
  return Math.round(n * 60); // treat bare number as hours
}

/** Format minutes as h:mm for preview */
function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h}h ${m}m`;
}

export default function UsageLogModal({ visible, asset, onClose, onSubmit }: Props) {
  const [distance, setDistance] = useState('');
  const [movingTime, setMovingTime] = useState('');
  const [elevation, setElevation] = useState('');
  const [steps, setSteps] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!asset) return null;

  const type = asset.type;

  const distNum = parseNum(distance);
  const timeMin = parseTime(movingTime);
  const elevNum = parseNum(elevation);
  const stepsNum = Math.round(parseNum(steps));

  const isValid = type === 'shoe'
    ? stepsNum > 0
    : distNum > 0;

  const reset = () => {
    setDistance(''); setMovingTime(''); setElevation(''); setSteps(''); setNotes('');
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const entry: UsageEntry = { notes: notes.trim() || undefined };
      if (type === 'shoe') {
        entry.steps = stepsNum;
      } else {
        entry.distance = distNum;
        if (movingTime.trim()) entry.movingTime = timeMin;
        if (type === 'bike' && elevation.trim()) entry.elevation = elevNum;
      }
      await onSubmit(entry);
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Log Usage — {asset.name}</Text>

          {type === 'shoe' ? (
            <>
              <Text style={styles.label}>Steps</Text>
              <TextInput
                {...uiProps(uiPath('fingo', 'usage_log_modal', 'steps_input'))}
                style={styles.input}
                value={steps}
                onChangeText={setSteps}
                placeholder="e.g. 8500"
                placeholderTextColor="#475569"
                keyboardType="numeric"
              />
              {stepsNum > 0 && (
                <Text style={styles.preview}>
                  {stepsNum.toLocaleString()} steps — total: {(asset.total_steps + stepsNum).toLocaleString()}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.label}>Distance (km)</Text>
              <TextInput
                {...uiProps(uiPath('fingo', 'usage_log_modal', 'distance_input'))}
                style={styles.input}
                value={distance}
                onChangeText={setDistance}
                placeholder="e.g. 42.5"
                placeholderTextColor="#475569"
                keyboardType="numeric"
              />
              {distNum > 0 && (
                <Text style={styles.preview}>
                  +{distNum.toLocaleString()} km — total: {((asset.total_distance ?? 0) + distNum).toLocaleString()} km
                </Text>
              )}

              <Text style={styles.label}>Moving time <Text style={styles.labelHint}>(h:mm or decimal hours, optional)</Text></Text>
              <TextInput
                {...uiProps(uiPath('fingo', 'usage_log_modal', 'time_input'))}
                style={styles.input}
                value={movingTime}
                onChangeText={setMovingTime}
                placeholder="e.g. 1:30 or 1.5"
                placeholderTextColor="#475569"
                keyboardType="numeric"
              />
              {movingTime.trim() && timeMin > 0 && (
                <Text style={styles.preview}>{formatMinutes(timeMin)}</Text>
              )}

              {type === 'bike' && (
                <>
                  <Text style={styles.label}>Elevation gain <Text style={styles.labelHint}>(m, optional)</Text></Text>
                  <TextInput
                    {...uiProps(uiPath('fingo', 'usage_log_modal', 'elevation_input'))}
                    style={styles.input}
                    value={elevation}
                    onChangeText={setElevation}
                    placeholder="e.g. 650"
                    placeholderTextColor="#475569"
                    keyboardType="numeric"
                  />
                  {elevNum > 0 && (
                    <Text style={styles.preview}>+{elevNum.toLocaleString()} m elevation</Text>
                  )}
                </>
              )}
            </>
          )}

          <Text style={styles.label}>Notes <Text style={styles.labelHint}>(optional)</Text></Text>
          <TextInput
            {...uiProps(uiPath('fingo', 'usage_log_modal', 'notes_input'))}
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="Route, weather, gear…"
            placeholderTextColor="#475569"
          />

          <View style={styles.actions}>
            <TouchableOpacity
              {...uiProps(uiPath('fingo', 'usage_log_modal', 'cancel_button'))}
              style={styles.cancelButton}
              onPress={() => { logUI(uiPath('fingo', 'usage_log_modal', 'cancel_button'), 'press'); onClose(); }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...uiProps(uiPath('fingo', 'usage_log_modal', 'submit_button'))}
              style={[styles.submitButton, (!isValid || submitting) && styles.submitDisabled]}
              onPress={() => { logUI(uiPath('fingo', 'usage_log_modal', 'submit_button'), 'press'); void handleSubmit(); }}
              disabled={!isValid || submitting}
            >
              <Text style={styles.submitText}>{submitting ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
  },
  title: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  labelHint: {
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 11,
  },
  input: {
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    color: '#CBD5E1',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  preview: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  cancelText: {
    color: '#64748B',
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#053d1e',
    borderWidth: 1,
    borderColor: '#4ade80',
    alignItems: 'center',
  },
  submitDisabled: {
    backgroundColor: '#0E1A2B',
    borderColor: '#1F3A59',
  },
  submitText: {
    color: '#4ade80',
    fontWeight: '700',
  },
});
