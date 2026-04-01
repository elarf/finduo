import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import Icon from '../Icon';
import type { Pool } from '../../types/pools';

type CreatorProfile = { display_name: string | null; avatar_url: string | null };

interface Props {
  pools: Pool[];
  loading: boolean;
  onOpenPool: (pool: Pool) => void;
  currentUserId: string;
  creatorProfiles: Record<string, CreatorProfile>;
}

export function PoolListContent({ pools, loading, onOpenPool, currentUserId, creatorProfiles }: Props) {
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());

  useEffect(() => {
    logUI(uiPath('pool_list', 'scroll_view', 'root'), 'mounted');
  }, []);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 40 }}
      {...uiProps(uiPath('pool_list', 'scroll_view', 'root'))}
    >
      {loading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 24 }} />}
      {!loading && pools.length === 0 && (
        <View style={s.emptyContainer} {...uiProps(uiPath('pool_list', 'empty_state', 'container'))}>
          <Icon name="Users" size={40} color="#1F3A59" />
          <Text style={s.emptyText} {...uiProps(uiPath('pool_list', 'empty_state', 'text'))}>No pools yet</Text>
          <Text style={s.emptyHint} {...uiProps(uiPath('pool_list', 'empty_state', 'hint'))}>Create a pool to split expenses with friends</Text>
        </View>
      )}
      {pools.map((pool) => {
        const isOwn = pool.created_by === currentUserId;
        const creator = !isOwn ? creatorProfiles[pool.created_by] : null;
        const creatorName = creator?.display_name ?? (!isOwn ? pool.created_by.slice(0, 8) : null);
        const creatorAvatar = creator?.avatar_url ?? null;
        const avatarFailed = failedAvatars.has(pool.created_by);
        const showAvatarImage = !!creatorAvatar && !avatarFailed;
        const initial = creatorName?.charAt(0).toUpperCase() ?? '?';
        const cardPath = uiPath('pool_list', 'pool_card', 'container', pool.id);

        return (
          <TouchableOpacity
            key={pool.id}
            style={s.card}
            onPress={() => {
              logUI(cardPath, 'press');
              onOpenPool(pool);
            }}
            {...uiProps(cardPath)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={[s.poolIcon, pool.status === 'closed' && { opacity: 0.4 }]}
                {...uiProps(uiPath('pool_list', 'pool_card', 'icon', pool.id))}
              >
                <Icon
                  name={pool.type === 'event' ? 'CalendarDays' : 'Repeat'}
                  size={18}
                  color="#53E3A6"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[s.poolName, pool.status === 'closed' && { color: '#475569' }]}
                  {...uiProps(uiPath('pool_list', 'pool_card', 'name', pool.id))}
                >
                  {pool.name}
                </Text>
                <View style={s.metaRow}>
                  <Text style={s.poolMeta} {...uiProps(uiPath('pool_list', 'pool_card', 'meta', pool.id))}>
                    {pool.type === 'event' ? 'Event' : 'Continuous'}
                    {pool.status === 'closed' ? ' \u00b7 Closed' : ''}
                  </Text>
                  {!isOwn && creatorName && (
                    <View style={s.creatorRow}>
                      <Text style={s.poolMeta}> · by </Text>
                      {showAvatarImage ? (
                        <Image
                          source={{ uri: creatorAvatar! }}
                          style={s.creatorAvatar}
                          onError={() => {
                            logUI(uiPath('pool_list', 'pool_card', 'creator_avatar', pool.id), 'avatar_error');
                            setFailedAvatars((prev) => new Set([...prev, pool.created_by]));
                          }}
                          {...uiProps(uiPath('pool_list', 'pool_card', 'creator_avatar', pool.id))}
                        />
                      ) : (
                        <View
                          style={s.creatorAvatarFallback}
                          {...uiProps(uiPath('pool_list', 'pool_card', 'creator_avatar_fallback', pool.id))}
                        >
                          <Text style={s.creatorAvatarLetter}>{initial}</Text>
                        </View>
                      )}
                      <Text style={s.poolMeta}>{creatorName}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Icon name="ChevronRight" size={16} color="#475569" />
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#0E1A2B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 14,
  },
  poolIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0D2818',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolName: {
    color: '#EAF3FF',
    fontSize: 15,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  poolMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  creatorAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  creatorAvatarFallback: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1F3A59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarLetter: {
    color: '#BAD0EE',
    fontSize: 7,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    gap: 8,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyHint: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
  },
});
