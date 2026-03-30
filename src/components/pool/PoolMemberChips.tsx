import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PoolMember } from '../../types/pools';

interface Props {
  members: PoolMember[];
  currentUserId: string;
}

export function PoolMemberChips({ members, currentUserId }: Props) {
  if (members.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
    >
      {members.map((m) => {
        const label =
          m.display_name ?? (m.user_id === currentUserId ? 'You' : (m.user_id?.slice(0, 8) ?? '?'));
        const isExternal = !m.user_id;
        return (
          <View key={m.id} style={[s.chip, isExternal && s.chipExternal]}>
            <Text style={s.chipText}>{label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  chip: {
    backgroundColor: '#1F3A59',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipExternal: {
    backgroundColor: '#2A1F3A',
  },
  chipText: {
    color: '#BAD0EE',
    fontSize: 12,
  },
});
