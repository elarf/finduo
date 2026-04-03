/**
 * Shared debt list with four sub-sections: Pending, Ready to record, Recorded,
 * and Archived (collapsed by default). Used by both LendingSection and
 * SettlementsSection so the behaviour is always identical.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../Icon';
import type { AppDebt } from '../../types/pools';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

// ── DebtRow ──────────────────────────────────────────────────────────────────

function DebtRow({ debt, userId, onConfirm, onConvert, onArchive, onDelete, screen }: {
  debt: AppDebt;
  userId: string;
  onConfirm: (id: string) => void;
  onConvert: (debt: AppDebt) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  screen: string;
}) {
  const iOwe = debt.from_user === userId;
  const myConfirmed = iOwe ? debt.from_confirmed : debt.to_confirmed;
  const otherConfirmed = iOwe ? debt.to_confirmed : debt.from_confirmed;

  const otherParticipantName = iOwe ? debt.to_participant_name : debt.from_participant_name;
  const isBroken = !otherParticipantName || otherParticipantName === 'Unknown';
  const otherName = isBroken ? 'Unknown contact' : otherParticipantName;

  const statusColor =
    debt.status === 'archived' ? '#475569' :
    debt.status === 'recorded' || debt.status === 'paid' ? '#4ade80' :
    debt.status === 'confirmed' ? '#53E3A6' :
    '#f59e0b';

  const canConfirm = debt.status === 'pending' && !myConfirmed;
  const canRecord =
    (debt.status === 'pending' && myConfirmed) ||
    debt.status === 'confirmed' ||
    debt.status === 'archived';
  const canArchive = debt.status === 'recorded' || debt.status === 'paid';

  return (
    <View style={s.debtRow} {...uiProps(uiPath(screen, 'debt_row', 'container', debt.id))}>
      <View style={s.debtIcon} {...uiProps(uiPath(screen, 'debt_row', 'icon', debt.id))}>
        <Icon name={iOwe ? 'ArrowUpRight' : 'ArrowDownLeft'} size={18} color={iOwe ? '#f87171' : '#4ade80'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.debtText, isBroken && s.debtTextBroken]} {...uiProps(uiPath(screen, 'debt_row', 'text', debt.id))}>
          {iOwe ? `You owe ${otherName}` : `${otherName} owes you`}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <View style={[s.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}
            {...uiProps(uiPath(screen, 'debt_row', 'status_badge', debt.id))}>
            <Text style={[s.statusText, { color: statusColor }]}>{debt.status}</Text>
          </View>
          {debt.pool_id && <Text style={s.debtMeta}>pool</Text>}
          {isBroken && <Text style={s.debtMetaBroken}>broken</Text>}
          {myConfirmed && debt.status === 'pending' && <Text style={s.debtMeta}>you confirmed</Text>}
          {otherConfirmed && debt.status === 'pending' && <Text style={s.debtMeta}>they confirmed</Text>}
        </View>
      </View>
      <Text style={[s.debtAmount, { color: iOwe ? '#f87171' : '#4ade80' }]}
        {...uiProps(uiPath(screen, 'debt_row', 'amount', debt.id))}>
        {iOwe ? '-' : '+'}{Number(debt.amount).toFixed(2)}
      </Text>
      <View style={s.debtActions}>
        {canConfirm && (
          <TouchableOpacity style={s.confirmBtn} onPress={() => {
            logUI(uiPath(screen, 'debt_row', 'confirm_button', debt.id), 'press');
            onConfirm(debt.id);
          }} {...uiProps(uiPath(screen, 'debt_row', 'confirm_button', debt.id))}>
            <Icon name="Check" size={14} color="#060A14" />
          </TouchableOpacity>
        )}
        {canRecord && !isBroken && (
          <TouchableOpacity style={s.convertBtn} onPress={() => {
            logUI(uiPath(screen, 'debt_row', 'convert_button', debt.id), 'press');
            onConvert(debt);
          }} {...uiProps(uiPath(screen, 'debt_row', 'convert_button', debt.id))}>
            <Icon name="ArrowRightLeft" size={13} color="#060A14" />
            <Text style={s.convertBtnText}>Record</Text>
          </TouchableOpacity>
        )}
        {canArchive && !isBroken && (
          <TouchableOpacity style={s.archiveBtn} onPress={() => {
            logUI(uiPath(screen, 'debt_row', 'archive_button', debt.id), 'press');
            onArchive(debt.id);
          }} {...uiProps(uiPath(screen, 'debt_row', 'archive_button', debt.id))}>
            <Icon name="Archive" size={13} color="#475569" />
            <Text style={s.archiveBtnText}>Archive</Text>
          </TouchableOpacity>
        )}
        {isBroken && (
          <TouchableOpacity style={s.deleteBtn} onPress={() => {
            logUI(uiPath(screen, 'debt_row', 'delete_button', debt.id), 'press');
            onDelete(debt.id);
          }} {...uiProps(uiPath(screen, 'debt_row', 'delete_button', debt.id))}>
            <Icon name="Trash2" size={14} color="#f87171" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── DebtListSection ───────────────────────────────────────────────────────────

type Props = {
  debts: AppDebt[];
  userId: string;
  onConfirm: (id: string) => void;
  onConvert: (debt: AppDebt) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  /** uiPath screen namespace — 'lending' or 'settlements' */
  screen?: string;
};

export default function DebtListSection({
  debts,
  userId,
  onConfirm,
  onConvert,
  onArchive,
  onDelete,
  screen = 'lending',
}: Props) {
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  const pendingDebts = useMemo(() => debts.filter((d) => {
    if (d.status !== 'pending') return false;
    const iOwe = d.from_user === userId;
    const myConfirmed = iOwe ? d.from_confirmed : d.to_confirmed;
    return !myConfirmed;
  }), [debts, userId]);

  const readyDebts = useMemo(() => debts.filter((d) => {
    if (d.status === 'confirmed') return true;
    if (d.status === 'pending') {
      const iOwe = d.from_user === userId;
      const myConfirmed = iOwe ? d.from_confirmed : d.to_confirmed;
      return myConfirmed;
    }
    return false;
  }), [debts, userId]);

  const recordedDebts = useMemo(() =>
    debts.filter((d) => d.status === 'recorded' || d.status === 'paid'),
  [debts]);

  const archivedDebts = useMemo(() =>
    debts.filter((d) => d.status === 'archived'),
  [debts]);

  const rowProps = { userId, onConfirm, onConvert, onArchive, onDelete, screen };

  return (
    <View>
      {pendingDebts.length > 0 && (
        <>
          <Text style={s.sectionTitle} {...uiProps(uiPath(screen, 'section_title', 'pending'))}>
            Pending ({pendingDebts.length})
          </Text>
          {pendingDebts.map((d) => <DebtRow key={d.id} debt={d} {...rowProps} />)}
        </>
      )}

      {readyDebts.length > 0 && (
        <>
          <Text style={s.sectionTitle} {...uiProps(uiPath(screen, 'section_title', 'ready'))}>
            Ready to record ({readyDebts.length})
          </Text>
          {readyDebts.map((d) => <DebtRow key={d.id} debt={d} {...rowProps} />)}
        </>
      )}

      {recordedDebts.length > 0 && (
        <>
          <Text style={s.sectionTitle} {...uiProps(uiPath(screen, 'section_title', 'recorded'))}>
            Recorded ({recordedDebts.length})
          </Text>
          {recordedDebts.map((d) => <DebtRow key={d.id} debt={d} {...rowProps} />)}
        </>
      )}

      {archivedDebts.length > 0 && (
        <>
          <TouchableOpacity
            style={s.collapsibleHeader}
            onPress={() => setArchivedExpanded((v) => !v)}
            {...uiProps(uiPath(screen, 'section_title', 'archived'))}
          >
            <Text style={s.sectionTitle}>Archived ({archivedDebts.length})</Text>
            <Icon name={archivedExpanded ? 'ChevronUp' : 'ChevronDown'} size={14} color="#64748B" />
          </TouchableOpacity>
          {archivedExpanded && archivedDebts.map((d) => <DebtRow key={d.id} debt={d} {...rowProps} />)}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: {
    color: '#64748B', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginHorizontal: 16, marginTop: 20, marginBottom: 6,
  },
  collapsibleHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingRight: 16,
  },
  debtRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#101A2A', gap: 10,
  },
  debtIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#0E1A2B', alignItems: 'center', justifyContent: 'center' },
  debtText: { color: '#EAF3FF', fontSize: 14 },
  debtTextBroken: { color: '#64748B', fontStyle: 'italic' },
  debtMeta: { color: '#475569', fontSize: 10 },
  debtMetaBroken: { color: '#f87171', fontSize: 10, fontWeight: '600' },
  debtAmount: { fontSize: 15, fontWeight: '600' },
  debtActions: { flexDirection: 'row', gap: 6 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '600' },
  confirmBtn: { backgroundColor: '#53E3A6', borderRadius: 6, padding: 6 },
  convertBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#53E3A6', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  convertBtnText: { color: '#060A14', fontSize: 11, fontWeight: '700' },
  archiveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1F3A59', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  archiveBtnText: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  deleteBtn: { backgroundColor: '#1A0A0A', borderRadius: 6, padding: 6, borderWidth: 1, borderColor: '#f8717144' },
});
