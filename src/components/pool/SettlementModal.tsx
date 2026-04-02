import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { poolSharedStyles as sh } from './poolStyles';
import type { PoolMember, PoolTransaction, PreTransaction } from '../../types/pools';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  poolId: string;
  poolName: string;
  members: PoolMember[];
  transactions: PoolTransaction[];
  perPerson: number;
  computeSettlement: (poolId: string) => Promise<PreTransaction[]>;
  commitSettlement: (poolId: string, preTxs: PreTransaction[]) => Promise<void>;
}

export function SettlementModal({
  visible, onClose, onSaved,
  poolId, poolName,
  members, transactions, perPerson,
  computeSettlement, commitSettlement,
}: Props) {
  const [phase, setPhase] = useState<'preview' | 'transfers'>('preview');
  const [preTxs, setPreTxs] = useState<PreTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('preview');
    setPreTxs([]);
    setError(null);
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  // Per-member balance derived from local transaction state
  const memberBalances = useMemo(() => {
    const paidMap = new Map<string, number>();
    for (const tx of transactions) {
      paidMap.set(tx.paid_by, (paidMap.get(tx.paid_by) ?? 0) + Number(tx.amount));
    }
    return members.map((m) => {
      const paid = paidMap.get(m.id) ?? 0;
      return {
        id: m.id,
        name: m.display_name ?? m.external_name ?? '?',
        paid,
        deviation: paid - perPerson,
      };
    });
  }, [members, transactions, perPerson]);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await computeSettlement(poolId);
      setPreTxs(result);
      setPhase('transfers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compute settlement');
    } finally {
      setLoading(false);
    }
  }, [computeSettlement, poolId]);

  // Resolve display name from enriched members state (has profile data) rather
  // than from RPC metadata, which may return null for auth members added without
  // an explicit display_name (e.g. the pool creator).
  const resolveName = useCallback((participantDbId: string, userId: string | null) => {
    const m = members.find((x) => x.id === participantDbId || (userId && x.user_id === userId));
    return m?.display_name ?? m?.external_name ?? participantDbId.slice(0, 8);
  }, [members]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await commitSettlement(poolId, preTxs);
      reset();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settlement');
      setLoading(false);
    }
  }, [commitSettlement, onSaved, poolId, preTxs, reset]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={sh.modalBackdrop}>
        <View style={[sh.modalCard, s.card]}>

          <Text style={sh.modalTitle}>
            {phase === 'preview' ? `Settle "${poolName}"` : 'Settlement plan'}
          </Text>

          {phase === 'preview' && (
            <>
              <View style={s.tableHeader}>
                <Text style={[s.colName, s.headerCell]}>Member</Text>
                <Text style={[s.colNum, s.headerCell]}>Paid</Text>
                <Text style={[s.colNum, s.headerCell]}>Balance</Text>
              </View>
              <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
                {memberBalances.map(({ id, name, paid, deviation }) => (
                  <View key={id} style={s.tableRow}>
                    <Text style={[s.colName, s.cellText]} numberOfLines={1}>{name}</Text>
                    <Text style={[s.colNum, s.cellText]}>{paid.toFixed(2)}</Text>
                    <Text style={[s.colNum, deviation >= -0.005 ? s.positive : s.negative]}>
                      {deviation >= 0 ? '+' : ''}{deviation.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <Text style={s.hint}>Fair share: {perPerson.toFixed(2)} per person</Text>
            </>
          )}

          {phase === 'transfers' && (
            <>
              {preTxs.length === 0 ? (
                <Text style={s.balanced}>Everyone paid their fair share — nothing to settle!</Text>
              ) : (
                <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
                  {preTxs.map((tx, i) => (
                    <View key={i} style={s.transferRow}>
                      <View style={s.transferParties}>
                        <Text style={s.transferName} numberOfLines={1}>
                          {resolveName(tx.metadata.fromParticipantDbId ?? tx.fromParticipantId, tx.metadata.fromUserId ?? null)}
                        </Text>
                        <Text style={s.arrow}>→</Text>
                        <Text style={s.transferName} numberOfLines={1}>
                          {resolveName(tx.metadata.toParticipantDbId ?? tx.toParticipantId, tx.metadata.toUserId ?? null)}
                        </Text>
                      </View>
                      <Text style={s.transferAmount}>{tx.amount.toFixed(2)}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
              <Text style={s.hint}>
                {preTxs.length > 0
                  ? 'Saving locks this pool and creates settlement records for each transfer.'
                  : 'Pool is balanced. You can close without any settlements.'}
              </Text>
            </>
          )}

          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={sh.modalActions}>
            {phase === 'preview' ? (
              <TouchableOpacity style={sh.modalSecondary} onPress={handleClose} disabled={loading}>
                <Text style={sh.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={sh.modalSecondary} onPress={() => setPhase('preview')} disabled={loading}>
                <Text style={sh.modalSecondaryText}>← Back</Text>
              </TouchableOpacity>
            )}

            {phase === 'preview' && (
              <TouchableOpacity
                style={sh.modalPrimary}
                onPress={() => { void handleConfirm(); }}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#060A14" />
                  : <Text style={sh.modalPrimaryText}>Confirm</Text>}
              </TouchableOpacity>
            )}

            {phase === 'transfers' && preTxs.length > 0 && (
              <TouchableOpacity
                style={sh.modalPrimary}
                onPress={() => { void handleSave(); }}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#060A14" />
                  : <Text style={sh.modalPrimaryText}>Save</Text>}
              </TouchableOpacity>
            )}

            {phase === 'transfers' && preTxs.length === 0 && (
              <TouchableOpacity style={sh.modalPrimary} onPress={handleClose}>
                <Text style={sh.modalPrimaryText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  card: {
    maxHeight: '80%',
  },
  list: {
    maxHeight: 220,
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#1F3A59',
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#0E2A45',
  },
  headerCell: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  colName: {
    flex: 2,
  },
  colNum: {
    flex: 1,
    textAlign: 'right',
  },
  cellText: {
    color: '#BAD0EE',
    fontSize: 13,
  },
  positive: {
    color: '#53E3A6',
    fontSize: 13,
    textAlign: 'right',
  },
  negative: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'right',
  },
  hint: {
    color: '#475569',
    fontSize: 11,
    marginTop: 8,
  },
  error: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 8,
  },
  balanced: {
    color: '#53E3A6',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderColor: '#0E2A45',
    gap: 8,
  },
  transferParties: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  transferName: {
    color: '#EAF3FF',
    fontSize: 13,
    flexShrink: 1,
  },
  arrow: {
    color: '#64748B',
    fontSize: 13,
  },
  transferAmount: {
    color: '#53E3A6',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'right',
  },
});
