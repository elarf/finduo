import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import type { PoolMember } from '../../types/pools';

interface Props {
  members: PoolMember[];
  currentUserId: string;
}

export function PoolMemberChips({ members, currentUserId }: Props) {
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());

  useEffect(() => {
    logUI(uiPath('pool', 'member_chips', 'scroll_view'), 'mounted');
  }, []);

  if (members.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      {...uiProps(uiPath('pool', 'member_chips', 'scroll_view'))}
    >
      {members.map((m) => {
        const label =
          m.display_name ?? (m.user_id === currentUserId ? 'You' : (m.user_id?.slice(0, 8) ?? '?'));
        const isExternal = !m.user_id;
        const avatarUrl = m.avatar_url && !failedAvatars.has(m.id) ? m.avatar_url : null;
        const initial = label.charAt(0).toUpperCase();
        const chipPath = uiPath('pool', 'member_chips', 'chip', m.id);
        const avatarPath = uiPath('pool', 'member_chips', 'avatar', m.id);
        const fallbackPath = uiPath('pool', 'member_chips', 'avatar_fallback', m.id);
        const labelPath = uiPath('pool', 'member_chips', 'label', m.id);
        return (
          <View key={m.id} style={[s.chip, isExternal && s.chipExternal]} {...uiProps(chipPath)}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={s.avatar}
                onError={() => {
                  logUI(avatarPath, 'avatar_error');
                  setFailedAvatars((prev) => new Set([...prev, m.id]));
                }}
                {...uiProps(avatarPath)}
              />
            ) : (
              <View style={[s.avatarFallback, isExternal && s.avatarFallbackExternal]} {...uiProps(fallbackPath)}>
                <Text style={s.avatarLetter}>{initial}</Text>
              </View>
            )}
            <Text style={s.chipText} {...uiProps(labelPath)}>{label}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1F3A59',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipExternal: {
    backgroundColor: '#2A1F3A',
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  avatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: '#0E2A45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackExternal: {
    backgroundColor: '#1F1030',
  },
  avatarLetter: {
    color: '#BAD0EE',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  chipText: {
    color: '#BAD0EE',
    fontSize: 12,
  },
});
