import React from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from '../Icon';
import { styles } from '../../screens/DashboardScreen.styles';
import { AppAccount, AppCategory, AppTag, TransactionType } from '../../types/dashboard';

type EntryModalProps = {
  visible: boolean;
  onClose: () => void;
  desktopView: boolean;
  // Entry form state
  editingTransactionId: string | null;
  entryType: TransactionType;
  setEntryType: (v: TransactionType) => void;
  entryAmount: string;
  setEntryAmount: (v: string) => void;
  entryDate: string;
  entryNote: string;
  setEntryNote: (v: string) => void;
  entryCategoryId: string | null;
  setEntryCategoryId: (v: string | null) => void;
  entryTagIds: string[];
  toggleTag: (id: string) => void;
  entryHadInitialCategory: boolean;
  noteFieldFocused: boolean;
  setNoteFieldFocused: (v: boolean) => void;
  showEntryAccountPicker: boolean;
  setShowEntryAccountPicker: React.Dispatch<React.SetStateAction<boolean>>;
  // Account
  accounts: AppAccount[];
  entryAccountId: string | null;
  setEntryAccountId: (id: string) => void;
  entryAccount: AppAccount | null;
  selectedCurrency: string;
  // Data
  entryCategories: AppCategory[];
  entryTags: AppTag[];
  recentCategoryAmounts: number[];
  noteSuggestions: string[];
  // New tag inline
  newTagName: string;
  setNewTagName: (v: string) => void;
  createTag: () => Promise<void>;
  // Callbacks
  appendNumpad: (key: string) => void;
  saveEntry: () => Promise<void>;
  formatCurrency: (value: number, currencyOverride?: string) => string;
  openDatePicker: () => void;
  openAcctPickerSheet: (target: 'entry' | 'invite') => void;
  // Category picker (mobile)
  chooseCatPanResponder: { panHandlers: any };
  catPickerAnim: Animated.Value;
  isCatPickerOpen: boolean;
  dragHighlightedCatId: string | null;
  openCatPicker: () => void;
  closeCatPicker: () => void;
  catCellRefs: React.MutableRefObject<Record<string, View | null>>;
  catCellMeasurements: React.MutableRefObject<Record<string, { x: number; y: number; w: number; h: number }>>;
  height: number;
  // Refs
  noteInputRef: React.RefObject<TextInput | null>;
  // Saving state
  saving: boolean;
};

const EntryModal = React.memo(function EntryModal(props: EntryModalProps) {
  const {
    visible,
    onClose,
    desktopView,
    editingTransactionId,
    entryType,
    setEntryType,
    entryAmount,
    setEntryAmount,
    entryDate,
    entryNote,
    setEntryNote,
    entryCategoryId,
    setEntryCategoryId,
    entryTagIds,
    toggleTag,
    entryHadInitialCategory,
    noteFieldFocused,
    setNoteFieldFocused,
    showEntryAccountPicker,
    setShowEntryAccountPicker,
    accounts,
    entryAccountId,
    setEntryAccountId,
    entryAccount,
    selectedCurrency,
    entryCategories,
    entryTags,
    recentCategoryAmounts,
    noteSuggestions,
    newTagName,
    setNewTagName,
    createTag,
    appendNumpad,
    saveEntry,
    formatCurrency,
    openDatePicker,
    openAcctPickerSheet,
    chooseCatPanResponder,
    catPickerAnim,
    isCatPickerOpen,
    dragHighlightedCatId,
    openCatPicker,
    closeCatPicker,
    catCellRefs,
    catCellMeasurements,
    height,
    noteInputRef,
    saving,
  } = props;

  return (
    <Modal visible={visible} transparent animationType={desktopView ? 'none' : 'slide'} onRequestClose={onClose}>
      {desktopView ? (
        /* ─── DESKTOP: centred card modal ─── */
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <Pressable style={[styles.modalCard, styles.entryModalCard]} onPress={(event) => event.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.entryTopRow}>
                <TouchableOpacity
                  style={[styles.datePressable, styles.entryDateInput, { marginBottom: 10 }]}
                  onPress={openDatePicker}
                >
                  <Text style={styles.datePressableText}>{entryDate || 'Select date'}</Text>
                  <Icon name="calendar" size={16} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.entryAccountBtn, showEntryAccountPicker && styles.entryAccountBtnActive]}
                  onPress={() => setShowEntryAccountPicker((p) => !p)}
                >
                  <Text style={styles.entryAccountBtnText}>{entryAccount?.name ?? 'Account'} {showEntryAccountPicker ? '▾' : '▸'}</Text>
                </TouchableOpacity>
              </View>
              {showEntryAccountPicker && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.modalChipsRow, { marginBottom: 8 }]}>
                  {accounts.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.modalChip, entryAccountId === a.id && styles.modalChipActive]}
                      onPress={() => { setEntryAccountId(a.id); setShowEntryAccountPicker(false); }}
                    >
                      <Text style={styles.modalChipText}>{a.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <View style={styles.entryTypeRow}>
                <TouchableOpacity
                  style={[styles.toggleButton, entryType === 'income' && styles.toggleButtonActive]}
                  onPress={() => setEntryType('income')}
                >
                  <Text style={styles.toggleButtonText}>Income</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, entryType === 'expense' && styles.toggleButtonActive]}
                  onPress={() => setEntryType('expense')}
                >
                  <Text style={styles.toggleButtonText}>Expense</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.entryAmountDisplay}>
                <Text style={styles.entryAmountDisplayText}>{entryAmount || '0'}</Text>
              </View>
              <Text style={styles.entryCurrencyText}>{entryAccount?.currency ?? selectedCurrency}</Text>
              {recentCategoryAmounts.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipsRow}>
                  {recentCategoryAmounts.map((v) => (
                    <TouchableOpacity key={`${entryType}-${v}`} style={styles.modalChip} onPress={() => setEntryAmount(String(v))}>
                      <Text style={styles.modalChipText}>{formatCurrency(v, entryAccount?.currency)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <View style={styles.numpadGrid}>
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '<'].map((k) => (
                  <TouchableOpacity key={k} style={styles.numpadKey} onPress={() => appendNumpad(k)}>
                    <Text style={styles.numpadKeyText}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                ref={noteInputRef}
                value={entryNote}
                onChangeText={setEntryNote}
                placeholder="Note"
                placeholderTextColor="#64748B"
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={() => void saveEntry()}
                onFocus={() => setNoteFieldFocused(true)}
                onBlur={() => setTimeout(() => setNoteFieldFocused(false), 150)}
              />
              {noteFieldFocused && noteSuggestions.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.modalChipsRow, { marginBottom: 6 }]}>
                  {noteSuggestions.map((s) => (
                    <TouchableOpacity key={s} style={styles.modalChip} onPress={() => setEntryNote(s)}>
                      <Text style={styles.modalChipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <Text style={styles.modalLabel}>Tags</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipsRow}>
                {entryTags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={[styles.modalChip, entryTagIds.includes(tag.id) && styles.modalChipActive]}
                    onPress={() => toggleTag(tag.id)}
                  >
                    <Text style={styles.modalChipText}>#{tag.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.tagCreateRow}>
                <TextInput
                  placeholder="New tag"
                  placeholderTextColor="#64748B"
                  value={newTagName}
                  onChangeText={setNewTagName}
                  style={[styles.input, styles.tagInput]}
                />
                <TouchableOpacity style={styles.smallAction} onPress={() => void createTag()}>
                  <Text style={styles.smallActionText}>Add Tag</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipsRow}>
                {entryCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.modalChip, entryCategoryId === cat.id && styles.modalChipActive, cat.color ? { borderColor: cat.color } : undefined]}
                    onPress={() => setEntryCategoryId(cat.id)}
                  >
                    {cat.icon ? <Icon name={cat.icon as any} size={12} color={cat.color ?? '#EAF3FF'} style={{ marginRight: 3 }} /> : null}
                    <Text style={styles.modalChipText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={onClose}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={() => void saveEntry()} disabled={saving}>
                <Text style={styles.modalPrimaryText}>{editingTransactionId ? 'Update' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      ) : (
        /* ─── MOBILE: full-screen slide-up modal ─── */
        <View style={styles.entryModalFullscreen}>
          {/* Top bar */}
          <View style={styles.entryModalTopBar}>
            <TouchableOpacity onPress={onClose} style={styles.entryModalCloseBtn}>
              <Icon name="close" size={22} color="#8FA8C9" />
            </TouchableOpacity>
            <Text style={styles.entryModalTitle}>
              {editingTransactionId ? 'Edit' : (entryType === 'income' ? 'Income' : 'Expense')}
            </Text>
            <TouchableOpacity
              style={styles.entryAccountBtn}
              onPress={() => openAcctPickerSheet('entry')}
            >
              <Text style={styles.entryAccountBtnText}>{entryAccount?.name ?? 'Account'}</Text>
            </TouchableOpacity>
          </View>
          {/* Type toggle */}
          <View style={[styles.entryTypeRow, { marginHorizontal: 16 }]}>
            <TouchableOpacity
              style={[styles.toggleButton, entryType === 'income' && styles.toggleButtonActive]}
              onPress={() => setEntryType('income')}
            >
              <Text style={styles.toggleButtonText}>Income</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, entryType === 'expense' && styles.toggleButtonActive]}
              onPress={() => setEntryType('expense')}
            >
              <Text style={styles.toggleButtonText}>Expense</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.entryModalScrollContent}>
            {/* Amount display-only */}
            <View style={styles.entryAmountDisplay}>
              <Text style={styles.entryAmountDisplayText}>{entryAmount || '0'}</Text>
            </View>
            <Text style={styles.entryCurrencyText}>{entryAccount?.currency ?? selectedCurrency}</Text>
            {recentCategoryAmounts.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipsRow}>
                {recentCategoryAmounts.map((v) => (
                  <TouchableOpacity key={`${entryType}-${v}`} style={styles.modalChip} onPress={() => setEntryAmount(String(v))}>
                    <Text style={styles.modalChipText}>{formatCurrency(v, entryAccount?.currency)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {/* Numpad */}
            <View style={styles.numpadGrid}>
              {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '<'].map((k) => (
                <TouchableOpacity key={k} style={styles.numpadKey} onPress={() => appendNumpad(k)}>
                  <Text style={styles.numpadKeyText}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Date picker row */}
            <TouchableOpacity
              style={styles.datePressable}
              onPress={openDatePicker}
            >
              <Icon name="calendar" size={18} color="#8FA8C9" />
              <Text style={styles.datePressableText}>{entryDate || 'Select date'}</Text>
            </TouchableOpacity>
            {/* Note */}
            <TextInput
              ref={noteInputRef}
              value={entryNote}
              onChangeText={setEntryNote}
              placeholder="Note"
              placeholderTextColor="#64748B"
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => void saveEntry()}
              onFocus={() => setNoteFieldFocused(true)}
              onBlur={() => setTimeout(() => setNoteFieldFocused(false), 150)}
            />
            {noteFieldFocused && noteSuggestions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.modalChipsRow, { marginBottom: 6 }]}>
                {noteSuggestions.map((s) => (
                  <TouchableOpacity key={s} style={styles.modalChip} onPress={() => setEntryNote(s)}>
                    <Text style={styles.modalChipText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {/* Tags */}
            {entryTags.length > 0 && (
              <>
                <Text style={styles.modalLabel}>Tags</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.modalChipsRow, { marginBottom: 8 }]}>
                  {entryTags.map((tag) => (
                    <TouchableOpacity
                      key={tag.id}
                      style={[styles.modalChip, entryTagIds.includes(tag.id) && styles.modalChipActive]}
                      onPress={() => toggleTag(tag.id)}
                    >
                      <Text style={styles.modalChipText}>#{tag.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </ScrollView>
          {/* Bottom bar — conditional on category */}
          {(!entryCategoryId && !entryHadInitialCategory) ? (
            <View
              {...chooseCatPanResponder.panHandlers}
              style={styles.chooseCategoryBtn}
            >
              <Icon name="label" size={22} color="#060A14" />
              <Text style={styles.chooseCategoryBtnText}>Choose Category</Text>
            </View>
          ) : (
            <View style={styles.entryModalBottomBar}>
              <TouchableOpacity
                style={styles.categoryIndicatorBtn}
                onPress={openCatPicker}
              >
                {(() => {
                  const cat = entryCategories.find((c) => c.id === entryCategoryId);
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {cat?.icon
                        ? <Icon name={cat.icon as any} size={16} color={cat?.color ?? '#EAF3FF'} />
                        : <Icon name="label" size={16} color="#64748B" />}
                      <Text style={styles.categoryIndicatorText}>{cat?.name ?? 'No category'}</Text>
                      <Icon name="expand_more" size={14} color="#8FA8C9" />
                    </View>
                  );
                })()}
              </TouchableOpacity>
              <View style={styles.entryModalActions}>
                <TouchableOpacity style={styles.modalSecondary} onPress={onClose}>
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalPrimary} onPress={() => void saveEntry()} disabled={saving}>
                  <Text style={styles.modalPrimaryText}>{editingTransactionId ? 'Update' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ─── Embedded fullscreen category picker (swipe-up overlay) ─── */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: '#060A14',
                zIndex: 50,
                transform: [
                  {
                    translateY: catPickerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [height, 0],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents={isCatPickerOpen ? 'box-none' : 'none'}
          >
            <View style={styles.catPickerHeader}>
              <Text style={styles.catPickerTitle}>Choose Category</Text>
              <TouchableOpacity onPress={closeCatPicker}>
                <Icon name="close" size={24} color="#8FA8C9" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.catPickerGrid} showsVerticalScrollIndicator={false}>
              {entryCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  ref={(r) => { catCellRefs.current[cat.id] = r as any as View; }}
                  onLayout={() => {
                    // Measure after layout so we get correct window-relative coordinates
                    const ref = catCellRefs.current[cat.id];
                    if (ref) {
                      (ref as any).measureInWindow((x: number, y: number, w: number, h: number) => {
                        catCellMeasurements.current[cat.id] = { x, y, w, h };
                      });
                    }
                  }}
                  style={[
                    styles.catPickerItem,
                    (entryCategoryId === cat.id || dragHighlightedCatId === cat.id) && styles.catPickerItemActive,
                    cat.color ? { borderColor: cat.color } : undefined,
                    dragHighlightedCatId === cat.id ? { backgroundColor: `${cat.color ?? '#EAF2FF'}28` } : undefined,
                  ]}
                  onPress={() => { setEntryCategoryId(cat.id); closeCatPicker(); }}
                >
                  <Icon
                    name={(cat.icon ?? 'label') as any}
                    size={32}
                    color={cat.color ?? (cat.type === 'income' ? '#6ED8A5' : '#FCA5A5')}
                  />
                  <Text style={styles.catPickerItemText}>{cat.name}</Text>
                  <Text style={[styles.catPickerItemType, cat.type === 'income' && styles.incomeType]}>{cat.type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
});

export default EntryModal;
