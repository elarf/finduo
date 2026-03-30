import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../Icon';

interface Props {
  onAddExpense: () => void;
  onAddMember: () => void;
}

export function PoolActions({ onAddExpense, onAddMember }: Props) {
  return (
    <View style={s.row}>
      <TouchableOpacity style={s.primary} onPress={onAddExpense}>
        <Icon name="Plus" size={16} color="#060A14" />
        <Text style={s.primaryText}>Add expense</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.primary, s.secondary]} onPress={onAddMember}>
        <Icon name="UserPlus" size={16} color="#EAF3FF" />
        <Text style={[s.primaryText, { color: '#EAF3FF' }]}>Add member</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
  },
  primary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#53E3A6',
    borderRadius: 10,
    paddingVertical: 10,
  },
  secondary: {
    backgroundColor: '#1F3A59',
  },
  primaryText: {
    color: '#060A14',
    fontSize: 13,
    fontWeight: '600',
  },
});
