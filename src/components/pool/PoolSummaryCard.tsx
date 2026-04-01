import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { logUI, uiPath, uiProps } from '../../lib/devtools';

interface Props {
  total: number;
  memberCount: number;
  perPerson: number;
  /** Non-null when the current user is NOT the pool creator */
  creatorName?: string | null;
  creatorAvatar?: string | null;
}

export function PoolSummaryCard({ total, memberCount, perPerson, creatorName, creatorAvatar }: Props) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showCreator = !!creatorName;
  const showAvatarImage = !!creatorAvatar && !avatarFailed;

  useEffect(() => {
    logUI(uiPath('pool', 'summary_card', 'card'), 'mounted');
  }, []);

  return (
    <View style={s.card} {...uiProps(uiPath('pool', 'summary_card', 'card'))}>
      <View style={s.row}>
        <Text style={s.label}>Total</Text>
        <Text style={s.value} {...uiProps(uiPath('pool', 'summary_card', 'total_value'))}>{total.toFixed(2)}</Text>
      </View>
      <View style={s.row}>
        <Text style={s.label}>Members</Text>
        <Text style={s.value} {...uiProps(uiPath('pool', 'summary_card', 'members_value'))}>{memberCount}</Text>
      </View>
      <View style={s.row}>
        <Text style={s.label}>Per person</Text>
        <Text style={s.value} {...uiProps(uiPath('pool', 'summary_card', 'per_person_value'))}>{perPerson.toFixed(2)}</Text>
      </View>
      {showCreator && (
        <View style={s.row}>
          <Text style={s.label}>Created by</Text>
          <View style={s.creatorRight}>
            {showAvatarImage ? (
              <Image
                source={{ uri: creatorAvatar! }}
                style={s.creatorAvatar}
                onError={() => {
                  logUI(uiPath('pool', 'summary_card', 'creator_avatar'), 'avatar_error');
                  setAvatarFailed(true);
                }}
                {...uiProps(uiPath('pool', 'summary_card', 'creator_avatar'))}
              />
            ) : (
              <View style={s.creatorAvatarFallback} {...uiProps(uiPath('pool', 'summary_card', 'creator_avatar_fallback'))}>
                <Text style={s.creatorAvatarLetter}>{creatorName!.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={s.value} {...uiProps(uiPath('pool', 'summary_card', 'creator_name'))}>{creatorName}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#0E1A2B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 14,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#64748B',
    fontSize: 13,
  },
  value: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '600',
  },
  creatorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creatorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  creatorAvatarFallback: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1F3A59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarLetter: {
    color: '#BAD0EE',
    fontSize: 9,
    fontWeight: '600',
  },
});
