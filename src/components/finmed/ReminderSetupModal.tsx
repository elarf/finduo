import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import type {
  FinmedReminder, ReminderType, FrequencyType,
  FrequencyConfig, MedicationReminderConfig, MeasurementConfig,
  MeasurementKind, AppointmentConfig,
} from '../../types/finmed';

export const MEDICATION_UNITS = [
  'ampoule', 'application', 'capsule', 'drop', 'gram', 'milligram', 'milliliter',
  'patch', 'piece', 'pill', 'portion', 'puff', 'sachet', 'spray', 'tablespoon', 'teaspoon', 'unit',
];

const MEASUREMENT_PRESETS: { kind: MeasurementKind; label: string; unit: string }[] = [
  { kind: 'weight', label: 'Weight', unit: 'kg' },
  { kind: 'temperature', label: 'Temperature', unit: '°C' },
  { kind: 'blood_pressure', label: 'Blood pressure', unit: 'mmHg' },
  { kind: 'heart_rate', label: 'Resting heart rate', unit: 'bpm' },
  { kind: 'blood_oxygen', label: 'Blood oxygen (SpO2)', unit: '%' },
  { kind: 'blood_glucose', label: 'Blood glucose', unit: 'mg/dL' },
  { kind: 'nicotine', label: 'Nicotine', unit: '' },
  { kind: 'sleep_duration', label: 'Sleep duration', unit: 'h' },
  { kind: 'water_intake', label: 'Water intake', unit: 'mL' },
  { kind: 'steps', label: 'Steps', unit: 'steps' },
  { kind: 'mood_score', label: 'Mood score', unit: '/10' },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ReminderPayload = Omit<FinmedReminder, 'id' | 'user_id' | 'created_at'> & { id?: string };

interface ReminderSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (reminder: ReminderPayload) => Promise<boolean>;
  medications?: Array<{ id: string; name: string; unit: string }>;
  initialType?: ReminderType;
  editing?: FinmedReminder | null;
  onCreateMedStock?: () => void;
}

export default function ReminderSetupModal({
  visible, onClose, onSave, medications = [], initialType, editing, onCreateMedStock,
}: ReminderSetupModalProps) {
  const { bottom } = useSafeAreaInsets();

  const [step, setStep] = useState<'type' | 'config'>('type');
  const [type, setType] = useState<ReminderType>('medication');

  // shared fields
  const [label, setLabel] = useState('');
  const [freqType, setFreqType] = useState<FrequencyType>('multiple_times_daily');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [intervalHours, setIntervalHours] = useState('8');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [cycleIntake, setCycleIntake] = useState('21');
  const [cyclePause, setCyclePause] = useState('7');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');

  // medication fields
  const [medId, setMedId] = useState('');
  const [doseAmount, setDoseAmount] = useState('1');
  const [doseUnit, setDoseUnit] = useState('pill');

  // measurement fields
  const [measKind, setMeasKind] = useState<MeasurementKind>('weight');
  const [measCustomName, setMeasCustomName] = useState('');
  const [measUnit, setMeasUnit] = useState('kg');
  const [measTarget, setMeasTarget] = useState('');

  // appointment fields
  const [apptDate, setApptDate] = useState(new Date().toISOString().slice(0, 10));
  const [apptTime, setApptTime] = useState('09:00');
  const [apptDesc, setApptDesc] = useState('');

  // custom reminder fields
  const [customIcon, setCustomIcon] = useState('🔔');

  const [saving, setSaving] = useState(false);

  // Reset form when modal opens or editing changes
  useEffect(() => {
    if (!visible) return;

    if (editing) {
      // Load existing reminder
      setStep('config');
      setType(editing.type);
      setLabel(editing.label);
      setFreqType(editing.frequency_type);
      setTimes((editing.frequency_config as FrequencyConfig)?.times ?? ['08:00']);
      setIntervalHours(String((editing.frequency_config as FrequencyConfig)?.interval_hours ?? 8));
      setWeekdays((editing.frequency_config as FrequencyConfig)?.weekdays ?? []);
      setCycleIntake(String((editing.frequency_config as FrequencyConfig)?.cycle_intake_days ?? 21));
      setCyclePause(String((editing.frequency_config as FrequencyConfig)?.cycle_pause_days ?? 7));
      setStartDate(editing.start_date);
      setEndDate(editing.end_date ?? '');
      // Type-specific config
      if (editing.type === 'medication') {
        setMedId((editing.type_config as MedicationReminderConfig)?.medication_id ?? '');
        setDoseAmount(String((editing.type_config as MedicationReminderConfig)?.dose_amount ?? 1));
        setDoseUnit((editing.type_config as MedicationReminderConfig)?.dose_unit ?? 'pill');
      } else if (editing.type === 'measurement') {
        setMeasKind((editing.type_config as MeasurementConfig)?.kind ?? 'weight');
        setMeasCustomName((editing.type_config as MeasurementConfig)?.custom_name ?? '');
        setMeasUnit((editing.type_config as MeasurementConfig)?.unit ?? 'kg');
        setMeasTarget(String((editing.type_config as MeasurementConfig)?.target_value ?? ''));
      } else if (editing.type === 'appointment') {
        setApptDate((editing.type_config as AppointmentConfig)?.date ?? new Date().toISOString().slice(0, 10));
        setApptTime((editing.type_config as AppointmentConfig)?.time ?? '09:00');
        setApptDesc((editing.type_config as AppointmentConfig)?.description ?? '');
      } else if (editing.type === 'custom') {
        setCustomIcon((editing.type_config as any)?.icon ?? '🔔');
      }
    } else {
      // New reminder
      setStep(initialType ? 'config' : 'type');
      setType(initialType ?? 'medication');
      setLabel('');
      setFreqType('multiple_times_daily');
      setTimes(['08:00']);
      setIntervalHours('8');
      setWeekdays([]);
      setCycleIntake('21');
      setCyclePause('7');
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate('');
      setMedId('');
      setDoseAmount('1');
      setDoseUnit('pill');
      setMeasKind('weight');
      setMeasCustomName('');
      setMeasUnit('kg');
      setMeasTarget('');
      setApptDate(new Date().toISOString().slice(0, 10));
      setApptTime('09:00');
      setApptDesc('');
      setCustomIcon('🔔');
    }
  }, [visible, editing, initialType]);

  const reset = () => {
    setStep(initialType ? 'config' : 'type');
    setType(initialType ?? 'medication');
    setLabel('');
    setFreqType('multiple_times_daily');
    setTimes(['08:00']);
    setIntervalHours('8');
    setWeekdays([]);
    setCycleIntake('21');
    setCyclePause('7');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate('');
    setMedId('');
    setDoseAmount('1');
    setDoseUnit('pill');
    setMeasKind('weight');
    setMeasCustomName('');
    setMeasUnit('kg');
    setMeasTarget('');
    setApptDate(new Date().toISOString().slice(0, 10));
    setApptTime('09:00');
    setApptDesc('');
    setCustomIcon('🔔');
  };

  const selectType = (t: ReminderType) => {
    setType(t);
    if (t === 'appointment') setFreqType('on_demand');
    setStep('config');
  };

  const toggleWeekday = (d: number) => {
    setWeekdays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };

  const addTime = () => setTimes((prev) => [...prev, '08:00']);
  const removeTime = (i: number) => setTimes((prev) => prev.filter((_, idx) => idx !== i));
  const setTimeAt = (i: number, v: string) => setTimes((prev) => prev.map((t, idx) => idx === i ? v : t));

  const buildFrequencyConfig = (): FrequencyConfig => {
    if (freqType === 'interval') return { interval_hours: parseFloat(intervalHours) || 8 };
    if (freqType === 'multiple_times_daily') return { times };
    if (freqType === 'specific_day_of_week') return { weekdays };
    if (freqType === 'cyclic') return {
      cycle_intake_days: parseInt(cycleIntake, 10) || 21,
      cycle_pause_days: parseInt(cyclePause, 10) || 7,
    };
    return {};
  };

  const buildTypeConfig = () => {
    if (type === 'medication') return { medication_id: medId, dose_amount: parseFloat(doseAmount) || 1, dose_unit: doseUnit };
    if (type === 'measurement') return { kind: measKind, custom_name: measCustomName || undefined, unit: measUnit, target_value: measTarget ? parseFloat(measTarget) : undefined };
    if (type === 'symptom_check') return {};
    if (type === 'appointment') return { date: apptDate, time: apptTime, description: apptDesc };
    if (type === 'custom') return { icon: customIcon };
    return {};
  };

  const canSave = () => {
    if (!label.trim()) return false;
    if (type === 'appointment') return !!(apptDate && apptTime);
    if (freqType === 'specific_day_of_week' && weekdays.length === 0) return false;
    return true;
  };

  const handleSave = async () => {
    if (!canSave()) return;
    setSaving(true);
    const ok = await onSave({
      id: editing?.id,
      type,
      label: label.trim(),
      frequency_type: type === 'appointment' ? 'on_demand' : freqType,
      frequency_config: buildFrequencyConfig(),
      start_date: startDate,
      end_date: endDate || null,
      active: true,
      type_config: buildTypeConfig(),
    });
    setSaving(false);
    if (ok) { reset(); onClose(); }
  };

  const FREQ_OPTIONS: { key: FrequencyType; label: string }[] = type === 'medication'
    ? [
        { key: 'multiple_times_daily', label: `${times.length} times daily` },
        { key: 'interval', label: 'Every N hours' },
        { key: 'specific_day_of_week', label: 'Specific days' },
        { key: 'cyclic', label: 'Cyclic' },
        { key: 'on_demand', label: 'On demand' },
      ]
    : [
        { key: 'multiple_times_daily', label: `${times.length} times daily` },
        { key: 'interval', label: 'Every N hours' },
        { key: 'specific_day_of_week', label: 'Specific days' },
        { key: 'on_demand', label: 'On demand' },
      ];

  return (
    <Modal
      {...uiProps(uiPath('finmed', 'reminder_setup', 'modal'))}
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View {...uiProps(uiPath('finmed', 'reminder_setup', 'overlay'))} style={styles.overlay}>
        <Pressable {...uiProps(uiPath('finmed', 'reminder_setup', 'backdrop'))} style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView {...uiProps(uiPath('finmed', 'reminder_setup', 'wrapper'))} behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrapper}>
          <View {...uiProps(uiPath('finmed', 'reminder_setup', 'sheet'))} style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) }]}>
            <View {...uiProps(uiPath('finmed', 'reminder_setup', 'handle'))} style={styles.handle} />
            <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'title'))} style={styles.title}>
              {editing
                ? 'Edit Reminder'
                : step === 'type'
                  ? (onCreateMedStock ? 'What would you like to add?' : 'What type of reminder?')
                  : `New ${TYPE_LABELS[type]}`}
            </Text>

            {step === 'type' ? (
              <View {...uiProps(uiPath('finmed', 'reminder_setup', 'type_grid'))} style={styles.typeGrid}>
                {(Object.entries(TYPE_LABELS) as [ReminderType, string][]).map(([t, lbl]) => (
                  <TouchableOpacity
                    {...uiProps(uiPath('finmed', 'reminder_setup', 'type', t))}
                    key={t}
                    style={styles.typeCard}
                    onPress={() => { logUI(uiPath('finmed', 'reminder_setup', 'type', t), 'press'); selectType(t); }}
                  >
                    <Text style={styles.typeIcon}>{TYPE_ICONS[t]}</Text>
                    <Text style={styles.typeLabel}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
                {onCreateMedStock && (
                  <TouchableOpacity
                    {...uiProps(uiPath('finmed', 'reminder_setup', 'type', 'med_stock'))}
                    style={styles.typeCard}
                    onPress={() => { logUI(uiPath('finmed', 'reminder_setup', 'type', 'med_stock'), 'press'); onClose(); onCreateMedStock(); }}
                  >
                    <Text style={styles.typeIcon}>💊</Text>
                    <Text style={styles.typeLabel}>Med Stock</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <ScrollView {...uiProps(uiPath('finmed', 'reminder_setup', 'config_scroll'))} showsVerticalScrollIndicator={false}>
                {/* Label */}
                <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'label_text'))} style={styles.label}>Label</Text>
                <TextInput
                  {...uiProps(uiPath('finmed', 'reminder_setup', 'label_input'))}
                  style={styles.input}
                  value={label}
                  onChangeText={setLabel}
                  placeholder={type === 'medication' ? 'e.g. Foster morning' : type === 'measurement' ? 'e.g. Morning weight' : type === 'symptom_check' ? 'e.g. Daily mood check' : 'e.g. Dr. Smith follow-up'}
                  placeholderTextColor="#475569"
                />

                {/* TYPE-SPECIFIC CONFIG */}
                {type === 'medication' && (
                  <>
                    <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'medication_label'))} style={styles.label}>Medication</Text>
                    {medications.length === 0 ? (
                      <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'medication_hint'))} style={styles.hint}>No medications yet — add one first.</Text>
                    ) : (
                      <View {...uiProps(uiPath('finmed', 'reminder_setup', 'medication_row'))} style={styles.toggleRow}>
                        {medications.map((m) => (
                          <TouchableOpacity
                            {...uiProps(uiPath('finmed', 'reminder_setup', 'medication_chip', m.id))}
                            key={m.id}
                            style={[styles.chip, medId === m.id && styles.chipActive]}
                            onPress={() => setMedId(m.id)}
                          >
                            <Text style={[styles.chipText, medId === m.id && styles.chipTextActive]}>{m.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <View {...uiProps(uiPath('finmed', 'reminder_setup', 'dose_row'))} style={styles.row2}>
                      <View style={{ flex: 1 }}>
                        <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'dose_amount_label'))} style={styles.label}>Dose amount</Text>
                        <TextInput {...uiProps(uiPath('finmed', 'reminder_setup', 'dose_amount_input'))} style={styles.input} value={doseAmount} onChangeText={setDoseAmount} keyboardType="decimal-pad" placeholderTextColor="#475569" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'dose_unit_label'))} style={styles.label}>Unit</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                          <View {...uiProps(uiPath('finmed', 'reminder_setup', 'dose_unit_row'))} style={styles.toggleRow}>
                            {MEDICATION_UNITS.map((u) => (
                              <TouchableOpacity {...uiProps(uiPath('finmed', 'reminder_setup', 'dose_unit_chip', u))} key={u} style={[styles.chip, doseUnit === u && styles.chipActive]} onPress={() => setDoseUnit(u)}>
                                <Text style={[styles.chipText, doseUnit === u && styles.chipTextActive]}>{u}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    </View>
                  </>
                )}

                {type === 'measurement' && (
                  <>
                    <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'measurement_type_label'))} style={styles.label}>Measurement type</Text>
                    <View {...uiProps(uiPath('finmed', 'reminder_setup', 'measurement_type_row'))} style={styles.toggleRow}>
                      {MEASUREMENT_PRESETS.map((p) => (
                        <TouchableOpacity
                          {...uiProps(uiPath('finmed', 'reminder_setup', 'measurement_type_chip', p.kind))}
                          key={p.kind}
                          style={[styles.chip, measKind === p.kind && styles.chipActive]}
                          onPress={() => { setMeasKind(p.kind); if (p.unit) setMeasUnit(p.unit); }}
                        >
                          <Text style={[styles.chipText, measKind === p.kind && styles.chipTextActive]}>{p.label}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        {...uiProps(uiPath('finmed', 'reminder_setup', 'measurement_type_chip', 'custom'))}
                        style={[styles.chip, measKind === 'custom' && styles.chipActive]}
                        onPress={() => setMeasKind('custom')}
                      >
                        <Text style={[styles.chipText, measKind === 'custom' && styles.chipTextActive]}>Custom…</Text>
                      </TouchableOpacity>
                    </View>
                    {measKind === 'custom' && (
                      <>
                        <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'custom_name_label'))} style={styles.label}>Custom name</Text>
                        <TextInput {...uiProps(uiPath('finmed', 'reminder_setup', 'custom_name_input'))} style={styles.input} value={measCustomName} onChangeText={setMeasCustomName} placeholder="e.g. Vitamin D" placeholderTextColor="#475569" />
                      </>
                    )}
                    <View {...uiProps(uiPath('finmed', 'reminder_setup', 'measurement_values_row'))} style={styles.row2}>
                      <View style={{ flex: 1 }}>
                        <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'unit_label'))} style={styles.label}>Unit</Text>
                        <TextInput {...uiProps(uiPath('finmed', 'reminder_setup', 'unit_input'))} style={styles.input} value={measUnit} onChangeText={setMeasUnit} placeholder="kg, °C…" placeholderTextColor="#475569" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'target_label'))} style={styles.label}>Target (optional)</Text>
                        <TextInput {...uiProps(uiPath('finmed', 'reminder_setup', 'target_input'))} style={styles.input} value={measTarget} onChangeText={setMeasTarget} keyboardType="decimal-pad" placeholder="e.g. 75" placeholderTextColor="#475569" />
                      </View>
                    </View>
                  </>
                )}

                {type === 'appointment' && (
                  <>
                    <View {...uiProps(uiPath('finmed', 'reminder_setup', 'appointment_datetime_row'))} style={styles.row2}>
                      <View style={{ flex: 1 }}>
                        <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'appointment_date_label'))} style={styles.label}>Date</Text>
                        <TextInput {...uiProps(uiPath('finmed', 'reminder_setup', 'appointment_date_input'))} style={styles.input} value={apptDate} onChangeText={setApptDate} placeholder="YYYY-MM-DD" placeholderTextColor="#475569" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'appointment_time_label'))} style={styles.label}>Time</Text>
                        <TextInput {...uiProps(uiPath('finmed', 'reminder_setup', 'appointment_time_input'))} style={styles.input} value={apptTime} onChangeText={setApptTime} placeholder="HH:MM" placeholderTextColor="#475569" />
                      </View>
                    </View>
                    <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'appointment_desc_label'))} style={styles.label}>Description</Text>
                    <TextInput
                      {...uiProps(uiPath('finmed', 'reminder_setup', 'appointment_desc_input'))}
                      style={[styles.input, styles.multiline]}
                      value={apptDesc}
                      onChangeText={setApptDesc}
                      multiline
                      placeholder="Any notes about this appointment"
                      placeholderTextColor="#475569"
                      scrollEnabled={false}
                    />
                  </>
                )}

                {type === 'custom' && (
                  <>
                    <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'custom_icon_label'))} style={styles.label}>Icon</Text>
                    <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'custom_icon_hint'))} style={styles.hint}>Choose an icon for this reminder's notification</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                      <View {...uiProps(uiPath('finmed', 'reminder_setup', 'custom_icon_row'))} style={styles.toggleRow}>
                        {['🔔', '⏰', '⚡', '💪', '🌙', '☀️', '💧', '🍎', '🏃', '🧘', '📖', '✍️', '🎯', '⭐', '🔥'].map((emoji) => (
                          <TouchableOpacity
                            {...uiProps(uiPath('finmed', 'reminder_setup', 'custom_icon_chip', emoji))}
                            key={emoji}
                            style={[styles.iconChip, customIcon === emoji && styles.iconChipActive]}
                            onPress={() => setCustomIcon(emoji)}
                          >
                            <Text style={styles.iconChipText}>{emoji}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </>
                )}

                {/* FREQUENCY — not for appointment */}
                {type !== 'appointment' && (
                  <>
                    <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'frequency_label'))} style={styles.label}>Frequency</Text>
                    <View {...uiProps(uiPath('finmed', 'reminder_setup', 'frequency_row'))} style={styles.toggleRow}>
                      {FREQ_OPTIONS.map((fo) => (
                        <TouchableOpacity
                          {...uiProps(uiPath('finmed', 'reminder_setup', 'frequency_chip', fo.key))}
                          key={fo.key}
                          style={[styles.chip, freqType === fo.key && styles.chipActive]}
                          onPress={() => setFreqType(fo.key)}
                        >
                          <Text style={[styles.chipText, freqType === fo.key && styles.chipTextActive]}>{fo.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {freqType === 'multiple_times_daily' && (
                      <>
                        {times.map((t, i) => (
                          <View {...uiProps(uiPath('finmed', 'reminder_setup', 'time_row', i))} key={i} style={styles.timeRow}>
                            <TextInput
                              {...uiProps(uiPath('finmed', 'reminder_setup', 'time_input', i))}
                              style={[styles.input, { flex: 1 }]}
                              value={t}
                              onChangeText={(v) => setTimeAt(i, v)}
                              placeholder="HH:MM"
                              placeholderTextColor="#475569"
                            />
                            {times.length > 1 && (
                              <TouchableOpacity {...uiProps(uiPath('finmed', 'reminder_setup', 'remove_time_btn', i))} style={styles.removeBtn} onPress={() => removeTime(i)}>
                                <Text style={styles.removeBtnText}>✕</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                        <TouchableOpacity {...uiProps(uiPath('finmed', 'reminder_setup', 'add_time_btn'))} style={styles.addTimeBtn} onPress={addTime}>
                          <Text style={styles.addTimeBtnText}>＋ Add time</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {freqType === 'interval' && (
                      <>
                        <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'interval_label'))} style={styles.label}>Every (hours)</Text>
                        <TextInput {...uiProps(uiPath('finmed', 'reminder_setup', 'interval_input'))} style={styles.input} value={intervalHours} onChangeText={setIntervalHours} keyboardType="decimal-pad" placeholderTextColor="#475569" />
                      </>
                    )}

                    {freqType === 'specific_day_of_week' && (
                      <>
                        <View {...uiProps(uiPath('finmed', 'reminder_setup', 'weekday_row'))} style={styles.toggleRow}>
                          {WEEKDAY_LABELS.map((d, i) => (
                            <TouchableOpacity
                              {...uiProps(uiPath('finmed', 'reminder_setup', 'weekday_chip', i))}
                              key={i}
                              style={[styles.dayChip, weekdays.includes(i) && styles.dayChipActive]}
                              onPress={() => toggleWeekday(i)}
                            >
                              <Text style={[styles.dayChipText, weekdays.includes(i) && styles.dayChipTextActive]}>{d}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'weekday_time_label'))} style={styles.label}>Reminder time</Text>
                        <TextInput
                          {...uiProps(uiPath('finmed', 'reminder_setup', 'weekday_time_input'))}
                          style={styles.input}
                          value={times[0]}
                          onChangeText={(v) => setTimeAt(0, v)}
                          placeholder="HH:MM"
                          placeholderTextColor="#475569"
                        />
                      </>
                    )}

                    {freqType === 'cyclic' && (
                      <>
                        <View {...uiProps(uiPath('finmed', 'reminder_setup', 'cyclic_row'))} style={styles.row2}>
                          <View style={{ flex: 1 }}>
                            <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'cyclic_intake_label'))} style={styles.label}>Intake days</Text>
                            <TextInput {...uiProps(uiPath('finmed', 'reminder_setup', 'cyclic_intake_input'))} style={styles.input} value={cycleIntake} onChangeText={setCycleIntake} keyboardType="number-pad" placeholderTextColor="#475569" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'cyclic_pause_label'))} style={styles.label}>Pause days</Text>
                            <TextInput {...uiProps(uiPath('finmed', 'reminder_setup', 'cyclic_pause_input'))} style={styles.input} value={cyclePause} onChangeText={setCyclePause} keyboardType="number-pad" placeholderTextColor="#475569" />
                          </View>
                        </View>
                        <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'cyclic_time_label'))} style={styles.label}>Reminder time</Text>
                        <TextInput
                          {...uiProps(uiPath('finmed', 'reminder_setup', 'cyclic_time_input'))}
                          style={styles.input}
                          value={times[0]}
                          onChangeText={(v) => setTimeAt(0, v)}
                          placeholder="HH:MM"
                          placeholderTextColor="#475569"
                        />
                      </>
                    )}

                    {freqType !== 'on_demand' && (
                      <>
                        <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'start_date_label'))} style={styles.label}>Start date</Text>
                        <TextInput {...uiProps(uiPath('finmed', 'reminder_setup', 'start_date_input'))} style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#475569" />
                        <Text {...uiProps(uiPath('finmed', 'reminder_setup', 'end_date_label'))} style={styles.label}>End date (optional)</Text>
                        <TextInput {...uiProps(uiPath('finmed', 'reminder_setup', 'end_date_input'))} style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor="#475569" />
                      </>
                    )}
                  </>
                )}

                <View {...uiProps(uiPath('finmed', 'reminder_setup', 'actions'))} style={styles.actions}>
                  <TouchableOpacity {...uiProps(uiPath('finmed', 'reminder_setup', 'cancel_button'))} style={styles.cancelBtn} onPress={onClose}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    {...uiProps(uiPath('finmed', 'reminder_setup', 'save_button'))}
                    style={[styles.saveBtn, (!canSave() || saving) && styles.saveBtnDisabled]}
                    onPress={() => { logUI(uiPath('finmed', 'reminder_setup', 'save_button'), 'press'); void handleSave(); }}
                    disabled={!canSave() || saving}
                  >
                    <Text style={styles.saveBtnText}>{saving ? 'Saving…' : editing ? 'Update' : 'Save reminder'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const TYPE_LABELS: Record<ReminderType, string> = {
  medication: 'Medication',
  measurement: 'Measurement',
  symptom_check: 'Symptom Check',
  appointment: 'Appointment',
  custom: 'Custom',
};

const TYPE_ICONS: Record<ReminderType, string> = {
  medication: '💊',
  measurement: '📏',
  symptom_check: '😐',
  appointment: '📅',
  custom: '🔔',
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  wrapper: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    maxHeight: '92%',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4,
    borderRadius: 2, backgroundColor: '#2C4669', marginBottom: 12,
  },
  title: { color: '#CBD5E1', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 },
  typeCard: {
    flex: 1, minWidth: '45%',
    borderRadius: 12, borderWidth: 1, borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B', paddingVertical: 20,
    alignItems: 'center', gap: 6,
  },
  typeIcon: { fontSize: 28 },
  typeLabel: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  label: {
    color: '#475569', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 10, marginBottom: 5,
  },
  hint: { color: '#475569', fontSize: 12, fontStyle: 'italic', marginBottom: 6 },
  input: {
    backgroundColor: '#0E1A2B', borderWidth: 1, borderColor: '#1F3A59',
    borderRadius: 8, color: '#CBD5E1', fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 10 },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: '#1F3A59', backgroundColor: '#0E1A2B',
  },
  chipActive: { borderColor: '#F472B6', backgroundColor: '#2d0a1a' },
  chipText: { color: '#475569', fontSize: 12 },
  chipTextActive: { color: '#F472B6', fontWeight: '600' },
  dayChip: {
    width: 40, height: 36, borderRadius: 8,
    borderWidth: 1, borderColor: '#1F3A59', backgroundColor: '#0E1A2B',
    alignItems: 'center', justifyContent: 'center',
  },
  dayChipActive: { borderColor: '#F472B6', backgroundColor: '#2d0a1a' },
  dayChipText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  dayChipTextActive: { color: '#F472B6' },
  iconChip: {
    width: 44, height: 44, borderRadius: 8,
    borderWidth: 1, borderColor: '#1F3A59', backgroundColor: '#0E1A2B',
    alignItems: 'center', justifyContent: 'center',
  },
  iconChipActive: { borderColor: '#F472B6', backgroundColor: '#2d0a1a' },
  iconChipText: { fontSize: 24 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeBtn: {
    width: 32, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { color: '#f87171', fontSize: 16 },
  addTimeBtn: {
    paddingVertical: 8, alignItems: 'center',
    borderRadius: 8, borderWidth: 1, borderColor: '#1F3A59', marginBottom: 4,
  },
  addTimeBtnText: { color: '#8FA8C9', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#1F3A59', alignItems: 'center',
  },
  cancelBtnText: { color: '#64748B', fontWeight: '600' },
  saveBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#2d0a1a', borderWidth: 1, borderColor: '#F472B6', alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  saveBtnText: { color: '#F472B6', fontWeight: '700' },
});
