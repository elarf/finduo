import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import type { ComponentServiceInterval, TrackingMethod, ServiceIntervalType } from '../../types/fingo';
import { trackingMethodLabel, trackingMethodUnit } from '../../lib/fingo/health';
import { FINGO_ASSETS } from '../../lib/fingo/fingoAssets';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

const METHODS: TrackingMethod[] = [
  'distance', 'moving_time', 'elapsed_time', 'rides', 'elevation_gain',
];

const SERVICE_TYPES: Array<{ value: ServiceIntervalType; label: string; icon: any }> = [
  { value: 'general',  label: 'Fix',     icon: FINGO_ASSETS.fix },
  { value: 'replace',  label: 'Replace', icon: FINGO_ASSETS.change },
  { value: 'cleaning', label: 'Clean',   icon: FINGO_ASSETS.wipe },
  { value: 'charge',   label: 'Charge',  icon: FINGO_ASSETS.charge },
  { value: 'pump',     label: 'Pump',    icon: FINGO_ASSETS.pressure },
];

const TIME_UNITS = ['h', 'd', 'y'] as const;
type TimeUnit = typeof TIME_UNITS[number];
const UNIT_MULTIPLIERS: Record<TimeUnit, number> = { h: 1, d: 24, y: 8760 };

interface Props {
  visible: boolean;
  componentName?: string;
  editingInterval?: ComponentServiceInterval | null;
  onSave: (name: string, method: TrackingMethod, intervalValue: number, serviceType: ServiceIntervalType) => Promise<void>;
  onClose: () => void;
}

export default function ServiceIntervalSheet({
  visible, componentName, editingInterval, onSave, onClose,
}: Props) {
  const [name, setName] = useState('');
  const [method, setMethod] = useState<TrackingMethod>('distance');
  const [valueStr, setValueStr] = useState('');
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('h');
  const [serviceType, setServiceType] = useState<ServiceIntervalType>('general');
  const [saving, setSaving] = useState(false);

  const isTimeBased = method === 'moving_time' || method === 'elapsed_time';

  useEffect(() => {
    if (visible) {
      setName(editingInterval?.name ?? '');
      setMethod(editingInterval?.tracking_method ?? 'distance');
      setTimeUnit('h');
      setValueStr(editingInterval ? String(editingInterval.interval_value) : '');
      setServiceType(editingInterval?.service_type ?? 'general');
    }
  }, [visible, editingInterval]);

  const intervalValue = parseFloat(valueStr.replace(',', '.')) * (isTimeBased ? UNIT_MULTIPLIERS[timeUnit] : 1);
  const canSave = name.trim() && !isNaN(intervalValue) && intervalValue > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      logUI(uiPath('fingo', 'service_interval_sheet', 'save'), 'press');
      await onSave(name.trim(), method, intervalValue, serviceType);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {editingInterval ? 'Edit Service Interval' : 'Add Service Interval'}
          </Text>
          {componentName && (
            <Text style={styles.subtitle}>{componentName}</Text>
          )}

          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Service name</Text>
            <TextInput
              {...uiProps(uiPath('fingo', 'service_interval_sheet', 'name_input'))}
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Lube chain, Replace tyre, Oil change…"
              placeholderTextColor="#475569"
              autoFocus
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {SERVICE_TYPES.map(({ value, label, icon }) => (
                <TouchableOpacity
                  {...uiProps(uiPath('fingo', 'service_interval_sheet', 'type', value))}
                  key={value}
                  style={[styles.typeBtn, serviceType === value && styles.typeBtnActive]}
                  onPress={() => {
                    logUI(uiPath('fingo', 'service_interval_sheet', 'type', value), 'press');
                    setServiceType(value);
                  }}
                >
                  <Image source={icon} style={styles.typeIcon} resizeMode="contain" />
                  <Text style={[styles.typeText, serviceType === value && styles.typeTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Track by</Text>
            <View style={styles.methodGrid}>
              {METHODS.map((m) => (
                <TouchableOpacity
                  {...uiProps(uiPath('fingo', 'service_interval_sheet', 'method', m))}
                  key={m}
                  style={[styles.methodBtn, method === m && styles.methodBtnActive]}
                  onPress={() => {
                    logUI(uiPath('fingo', 'service_interval_sheet', 'method', m), 'press');
                    setMethod(m);
                    setTimeUnit('h');
                  }}
                >
                  <Text style={[styles.methodText, method === m && styles.methodTextActive]}>
                    {trackingMethodLabel(m)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Service every</Text>
            <View style={styles.valueRow}>
              <TextInput
                {...uiProps(uiPath('fingo', 'service_interval_sheet', 'value_input'))}
                style={[styles.input, styles.valueInput]}
                value={valueStr}
                onChangeText={setValueStr}
                placeholder="e.g. 500"
                placeholderTextColor="#475569"
                keyboardType="decimal-pad"
              />
              {isTimeBased ? (
                <View style={styles.unitToggleRow}>
                  {TIME_UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitToggleBtn, timeUnit === u && styles.unitToggleBtnActive]}
                      onPress={() => {
                        const parsed = parseFloat(valueStr.replace(',', '.'));
                        if (!isNaN(parsed) && parsed > 0) {
                          const inHours = parsed * UNIT_MULTIPLIERS[timeUnit];
                          const inNew = inHours / UNIT_MULTIPLIERS[u];
                          setValueStr(String(Number(inNew.toFixed(2))));
                        }
                        setTimeUnit(u);
                      }}
                    >
                      <Text style={[styles.unitToggleText, timeUnit === u && styles.unitToggleTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.unitPill}>
                  <Text style={styles.unitText}>{trackingMethodUnit(method)}</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
              onPress={() => void handleSave()}
              disabled={!canSave || saving}
            >
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1F3A59',
    marginBottom: 14,
  },
  title: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 10,
  },
  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
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
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBtn: {
    flexBasis: '30%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#000000',
  },
  typeBtnActive: {
    backgroundColor: '#0D2137',
    borderColor: '#3B6A9E',
  },
  typeIcon: {
    width: 18,
    height: 18,
  },
  typeText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  typeTextActive: {
    color: '#8FA8C9',
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  methodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  methodBtnActive: {
    backgroundColor: '#0D2137',
    borderColor: '#3B6A9E',
  },
  methodText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '500',
  },
  methodTextActive: {
    color: '#8FA8C9',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueInput: {
    flex: 1,
  },
  unitPill: {
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  unitText: {
    color: '#8FA8C9',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  cancelText: { color: '#64748B', fontWeight: '600' },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#053d1e',
    borderWidth: 1,
    borderColor: '#4ade80',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#0E1A2B',
    borderColor: '#1F3A59',
  },
  saveText: { color: '#4ade80', fontWeight: '700' },
  unitToggleRow: {
    flexDirection: 'row',
    gap: 4,
  },
  unitToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitToggleBtnActive: {
    borderColor: '#3B6A9E',
    backgroundColor: '#0D2137',
  },
  unitToggleText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  unitToggleTextActive: {
    color: '#8FA8C9',
  },
});
