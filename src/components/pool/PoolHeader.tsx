import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Icon from '../Icon';
import { poolSharedStyles as sh } from './poolStyles';

interface Props {
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** Right-side actions — only shown when provided */
  onSettle?: () => void;
  onClose?: () => void;
  /** Simple icon-button action (e.g. "+" on the list view) */
  onAdd?: () => void;
}

export function PoolHeader({ title, subtitle, onBack, onSettle, onClose, onAdd }: Props) {
  return (
    <View style={sh.header}>
      <TouchableOpacity onPress={onBack} style={sh.backButton}>
        <Icon name="ArrowLeft" size={20} color="#EAF3FF" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={sh.headerTitle}>{title}</Text>
        {subtitle ? <Text style={sh.headerSub}>{subtitle}</Text> : null}
      </View>
      {onSettle && (
        <TouchableOpacity onPress={onSettle} style={sh.headerAction}>
          <Text style={{ color: '#53E3A6', fontSize: 13, fontWeight: '600' }}>Settle</Text>
        </TouchableOpacity>
      )}
      {onClose && (
        <TouchableOpacity onPress={onClose} style={sh.headerAction}>
          <Text style={{ color: '#f87171', fontSize: 13 }}>Close</Text>
        </TouchableOpacity>
      )}
      {onAdd && (
        <TouchableOpacity onPress={onAdd} style={sh.headerAction}>
          <Icon name="Plus" size={20} color="#53E3A6" />
        </TouchableOpacity>
      )}
    </View>
  );
}
