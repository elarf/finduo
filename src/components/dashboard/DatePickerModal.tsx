import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../../screens/DashboardScreen.styles';
import { todayIso } from '../../types/dashboard';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

type DatePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  entryDate: string;
  setEntryDate: (date: string) => void;
  dpYear: number;
  setDpYear: React.Dispatch<React.SetStateAction<number>>;
  dpMonth: number;
  setDpMonth: React.Dispatch<React.SetStateAction<number>>;
};

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  onClose,
  entryDate,
  setEntryDate,
  dpYear,
  setDpYear,
  dpMonth,
  setDpMonth,
}) => (
  <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
    <Pressable
      style={[styles.modalBackdrop, { zIndex: 99999 }]}
      onPress={() => { logUI(uiPath('date_picker', 'modal', 'backdrop'), 'press'); onClose(); }}
      {...uiProps(uiPath('date_picker', 'modal', 'backdrop'))}
    >
      <Pressable
        style={[styles.modalCard, styles.datePickerCard]}
        onPress={(e) => { logUI(uiPath('date_picker', 'modal', 'card'), 'press'); e.stopPropagation(); }}
        {...uiProps(uiPath('date_picker', 'modal', 'card'))}
      >
        <Text style={styles.modalTitle} {...uiProps(uiPath('date_picker', 'modal', 'title'))}>
          Select Date
        </Text>
        <View style={styles.dpMonthNav}>
          <TouchableOpacity
            style={styles.dpNavBtn}
            onPress={() => {
              logUI(uiPath('date_picker', 'nav', 'prev_month_button'), 'press');
              if (dpMonth === 0) { setDpMonth(11); setDpYear((y) => y - 1); }
              else { setDpMonth((m) => m - 1); }
            }}
            {...uiProps(uiPath('date_picker', 'nav', 'prev_month_button'))}
          >
            <Text style={styles.dpNavBtnText}>{'\u2039'}</Text>
          </TouchableOpacity>
          <Text style={styles.dpMonthTitle} {...uiProps(uiPath('date_picker', 'nav', 'month_label'))}>
            {new Date(dpYear, dpMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity
            style={styles.dpNavBtn}
            onPress={() => {
              logUI(uiPath('date_picker', 'nav', 'next_month_button'), 'press');
              if (dpMonth === 11) { setDpMonth(0); setDpYear((y) => y + 1); }
              else { setDpMonth((m) => m + 1); }
            }}
            {...uiProps(uiPath('date_picker', 'nav', 'next_month_button'))}
          >
            <Text style={styles.dpNavBtnText}>{'\u203A'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dpWeekRow}>
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d, i) => (
            <Text key={d} style={[styles.dpWeekDay, i >= 5 && { color: '#f87171' }]}>{d}</Text>
          ))}
        </View>
        <View style={styles.dpDayGrid}>
          {(() => {
            const rawFirstDay = new Date(dpYear, dpMonth, 1).getDay();
            // Shift so Monday=0 … Sunday=6
            const firstDay = (rawFirstDay + 6) % 7;
            const daysInMonth = new Date(dpYear, dpMonth + 1, 0).getDate();
            const cells: React.ReactNode[] = [];
            for (let i = 0; i < firstDay; i++) {
              cells.push(<View key={`blank-${i}`} style={styles.dpDayCell} />);
            }
            for (let d = 1; d <= daysInMonth; d++) {
              const isoDate = `${dpYear}-${String(dpMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const isSelected = entryDate === isoDate;
              const isToday = todayIso() === isoDate;
              const dow = new Date(dpYear, dpMonth, d).getDay(); // 0=Sun, 6=Sat
              const isWeekend = dow === 0 || dow === 6;
              cells.push(
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.dpDayCell,
                    isSelected && styles.dpDayCellSelected,
                    isToday && !isSelected && styles.dpDayCellToday,
                  ]}
                  onPress={() => { logUI(uiPath('date_picker', 'calendar', 'day_cell', String(d)), 'press'); setEntryDate(isoDate); onClose(); }}
                  {...uiProps(uiPath('date_picker', 'calendar', 'day_cell', String(d)))}
                >
                  <Text style={[styles.dpDayText, isSelected && styles.dpDayTextSelected, isWeekend && !isSelected && { color: '#f87171' }]}>{d}</Text>
                </TouchableOpacity>,
              );
            }
            return cells;
          })()}
        </View>
        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.modalSecondary}
            onPress={() => { logUI(uiPath('date_picker', 'actions', 'close_button'), 'press'); onClose(); }}
            {...uiProps(uiPath('date_picker', 'actions', 'close_button'))}
          >
            <Text style={styles.modalSecondaryText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  </Modal>
);

export default React.memo(DatePickerModal);
