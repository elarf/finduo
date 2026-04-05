import React, { useEffect, useMemo } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from '../Icon';
import { styles } from '../../screens/DashboardScreen.styles';
import { AppAccount, AppCategory, AppTag, TransactionType } from '../../types/dashboard';
import { uiPath, uiProps, logUI } from '../../lib/devtools';
import NumpadGrid, { ENTRY_KEYS } from '../NumpadGrid';
import DateButton from '../DateButton';

type EntryModalProps = {
  visible: boolean;
  onClose: () => void;
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
  noteFieldFocused: boolean;
  setNoteFieldFocused: (v: boolean) => void;
  // Account
  accounts: AppAccount[];
  entryAccountId: string | null;
  setEntryAccountId: (id: string) => void;
  entryAccount: AppAccount | null;
  selectedCurrency: string;
  // Data
  entryCategories: AppCategory[];
  entryTags: AppTag[];
  entryTagUsage: Record<string, number>;
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
  openAcctPickerSheet: (target: 'entry' | 'invite' | 'transfer-from' | 'transfer-to') => void;
  // Category picker
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
  // Delete (edit mode only)
  onDelete?: () => void;
};

const EntryModal = React.memo(function EntryModal(props: EntryModalProps) {
  const {
    visible,
    onClose,
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
    noteFieldFocused,
    setNoteFieldFocused,
    accounts,
    entryAccountId,
    setEntryAccountId,
    entryAccount,
    selectedCurrency,
    entryCategories,
    entryTags,
    entryTagUsage,
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
    onDelete,
  } = props;

  const [tagSearchQuery, setTagSearchQuery] = React.useState('');

  useEffect(() => {
    logUI(uiPath('entry_modal', 'card', 'container'), 'mount');
  }, []);

  const { width: screenWidth } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && screenWidth >= 1024;

  const isIncome = entryType === 'income';
  const amountColor = isIncome ? '#4ade80' : '#ff5555';
  const currency = entryAccount?.currency ?? selectedCurrency;
  const currencySymbol: { prefix: string; suffix: string } = (() => {
    const map: Record<string, { prefix: string; suffix: string }> = {
      USD: { prefix: '$', suffix: '' }, EUR: { prefix: '€', suffix: '' },
      GBP: { prefix: '£', suffix: '' }, JPY: { prefix: '¥', suffix: '' },
      CHF: { prefix: 'Fr', suffix: '' }, HUF: { prefix: '', suffix: 'Ft' },
      SEK: { prefix: '', suffix: 'kr' }, NOK: { prefix: '', suffix: 'kr' },
      DKK: { prefix: '', suffix: 'kr' }, PLN: { prefix: '', suffix: 'zł' },
      CZK: { prefix: '', suffix: 'Kč' }, RUB: { prefix: '₽', suffix: '' },
      CNY: { prefix: '¥', suffix: '' }, KRW: { prefix: '₩', suffix: '' },
      INR: { prefix: '₹', suffix: '' }, AUD: { prefix: 'A$', suffix: '' },
      CAD: { prefix: 'C$', suffix: '' }, NZD: { prefix: 'NZ$', suffix: '' },
    };
    return map[currency] ?? { prefix: '', suffix: currency };
  })();

  const sortedEntryTags = useMemo(
    () => [...entryTags].sort((a, b) => (entryTagUsage[b.id] ?? 0) - (entryTagUsage[a.id] ?? 0)),
    [entryTags, entryTagUsage],
  );

  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return sortedEntryTags;
    const query = tagSearchQuery.toLowerCase();
    return sortedEntryTags.filter((t) => t.name.toLowerCase().includes(query));
  }, [sortedEntryTags, tagSearchQuery]);

  const noMatchButSearching = tagSearchQuery.trim().length > 0 && filteredTags.length === 0;

  const handleCreateFromSearch = async () => {
    if (!tagSearchQuery.trim()) return;
    setNewTagName(tagSearchQuery.trim());
    await createTag();
    setTagSearchQuery('');
  };

  const selectedCategory = useMemo(
    () => (entryCategoryId ? entryCategories.find((c) => c.id === entryCategoryId) ?? null : null),
    [entryCategoryId, entryCategories],
  );

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this transaction?')) { onDelete?.(); }
    } else {
      Alert.alert('Delete transaction', 'Delete this transaction?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete?.() },
      ]);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View {...uiProps(uiPath('entry_modal', 'backdrop', 'container'))} style={[{ flex: 1 }, isWide && { backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }]}>
        {isWide && (
          <Pressable
            {...uiProps(uiPath('entry_modal', 'backdrop', 'container'))}
            style={StyleSheet.absoluteFill}
            onPress={() => {
              logUI(uiPath('entry_modal', 'backdrop', 'container'), 'press');
              onClose();
            }}
          />
        )}
        <View {...uiProps(uiPath('entry_modal', 'card', 'container'))} style={[styles.entryModalFullscreen, isWide && { width: 390, maxHeight: '90%' as any, borderRadius: 16, overflow: 'hidden' }]}>
          {/* Top bar */}
          <View style={styles.entryModalTopBar}>
            <TouchableOpacity
              {...uiProps(uiPath('entry_modal', 'type_toggle', isIncome ? 'income_button' : 'expense_button'))}
              onPress={() => {
                logUI(uiPath('entry_modal', 'type_toggle', isIncome ? 'income_button' : 'expense_button'), 'press');
                setEntryType(isIncome ? 'expense' : 'income');
              }}
              style={[styles.toggleButton, { flex: 0, minWidth: 110, paddingHorizontal: 20 }, isIncome ? styles.toggleButtonActiveIncome : styles.toggleButtonActiveExpense]}
            >
              <Text style={isIncome ? styles.toggleButtonTextIncome : styles.toggleButtonTextExpense}>
                {isIncome ? 'Income' : 'Expense'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...uiProps(uiPath('entry_modal', 'account_picker', 'button'))}
              style={[styles.entryAccountBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
              onPress={() => {
                logUI(uiPath('entry_modal', 'account_picker', 'button'), 'press');
                openAcctPickerSheet('entry');
              }}
            >
              {entryAccount?.icon ? (
                <Icon
                  {...uiProps(uiPath('entry_modal', 'account_picker', 'icon'))}
                  name={entryAccount.icon as any}
                  size={13}
                  color="#8FA8C9"
                />
              ) : null}
              <Text style={styles.entryAccountBtnText}>{entryAccount?.name ?? 'Account'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.entryModalScrollContent, { flexGrow: 1 }]}
          >
            {/* 1. Date picker */}
            <DateButton
              date={entryDate}
              onPress={openDatePicker}
              screen="entry_modal"
              component="date_picker"
              style={{ marginBottom: 6 }}
            />
            {/* 2. Amount display + suggested values */}
            <View {...uiProps(uiPath('entry_modal', 'amount', 'display'))} style={[styles.entryAmountDisplay, { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4, paddingHorizontal: 12 }]}>
              {currencySymbol.prefix ? (
                <Text {...uiProps(uiPath('entry_modal', 'amount', 'currency'))} style={localStyles.currencyTag}>
                  {currencySymbol.prefix}
                </Text>
              ) : null}
              <Text {...uiProps(uiPath('entry_modal', 'amount', 'text'))} style={[styles.entryAmountDisplayText, { color: amountColor }]}>
                {entryAmount || '0'}
              </Text>
              {currencySymbol.suffix ? (
                <Text {...uiProps(uiPath('entry_modal', 'amount', 'currency'))} style={localStyles.currencyTag}>
                  {currencySymbol.suffix}
                </Text>
              ) : null}
            </View>
            {recentCategoryAmounts.length > 0 && (
              <ScrollView
                {...uiProps(uiPath('entry_modal', 'recent_amounts', 'container'))}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.modalChipsRow, { alignItems: 'flex-start' }]}
              >
                {recentCategoryAmounts.map((v, index) => (
                  <TouchableOpacity
                    {...uiProps(uiPath('entry_modal', 'recent_amounts', 'chip', String(index)))}
                    key={`${entryType}-${v}`}
                    style={[styles.modalChip, { alignSelf: 'flex-start' }]}
                    onPress={() => {
                      logUI(uiPath('entry_modal', 'recent_amounts', 'chip', String(index)), 'press');
                      setEntryAmount(String(v));
                    }}
                  >
                    <Text style={[styles.modalChipText, { fontSize: 13 }]}>{formatCurrency(v, entryAccount?.currency)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {/* 3. Note — tag preview inline + editable note */}
            <View style={[styles.input, { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginBottom: 6 }]}>
              {sortedEntryTags
                .filter((t) => entryTagIds.includes(t.id))
                .map((tag) => (
                  <View key={tag.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    {tag.icon ? <Icon name={tag.icon as any} size={12} color={tag.color ?? '#8FA8C9'} /> : null}
                    <Text style={{ color: tag.color ?? '#8FA8C9', fontSize: 14, fontWeight: '600' }}>#{tag.name}</Text>
                  </View>
                ))}
              <TextInput
                {...uiProps(uiPath('entry_modal', 'note', 'input'))}
                ref={noteInputRef}
                value={entryNote}
                onChangeText={setEntryNote}
                placeholder={entryTagIds.length > 0 ? 'add note…' : 'Note'}
                placeholderTextColor="#64748B"
                style={{ flex: 1, minWidth: 60, color: '#EDF5FF', fontSize: 14, padding: 0 }}
                returnKeyType="done"
                onSubmitEditing={() => void saveEntry()}
                onFocus={() => setNoteFieldFocused(true)}
                onBlur={() => setTimeout(() => setNoteFieldFocused(false), 150)}
              />
            </View>
            {noteFieldFocused && noteSuggestions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.modalChipsRow, { marginBottom: 6 }]}>
                {noteSuggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.modalChip}
                    onPress={() => {
                      logUI(uiPath('entry_modal', 'note', 'suggestion'), 'press');
                      setEntryNote(s);
                    }}
                  >
                    <Text style={styles.modalChipText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {/* 4. Tags — 2 rows max with search first, scrollable results */}
            <View {...uiProps(uiPath('entry_modal', 'tags', 'container'))} style={{ marginTop: 8, marginBottom: 8 }}>
              {/* Search/Add field always first - fixed at top */}
              {sortedEntryTags.length > 0 ? (
                <View style={localStyles.tagSearchBox}>
                  <Icon name="Search" size={12} color="#4A6280" />
                  <TextInput
                    placeholder="search tags…"
                    placeholderTextColor="#4A6280"
                    value={tagSearchQuery}
                    onChangeText={setTagSearchQuery}
                    style={localStyles.tagSearchInput}
                    returnKeyType="done"
                  />
                  {tagSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setTagSearchQuery('')} hitSlop={8}>
                      <Icon name="X" size={12} color="#4A6280" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={localStyles.newTagInline}>
                  <TextInput
                    placeholder="+ new tag"
                    placeholderTextColor="#4A6280"
                    value={newTagName}
                    onChangeText={setNewTagName}
                    style={localStyles.newTagInput}
                    returnKeyType="done"
                    onSubmitEditing={() => void createTag()}
                  />
                  {newTagName.trim().length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        logUI(uiPath('entry_modal', 'tags', 'new_tag_add'), 'press');
                        void createTag();
                      }}
                    >
                      <Text style={localStyles.newTagAdd}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Scrollable tags area - max 2 rows */}
              {sortedEntryTags.length > 0 && (
                <ScrollView
                  horizontal={false}
                  showsVerticalScrollIndicator={false}
                  style={localStyles.tagsScrollArea}
                  contentContainerStyle={localStyles.tagsWrap}
                  keyboardShouldPersistTaps="handled"
                >
                  {noMatchButSearching ? (
                    <TouchableOpacity
                      {...uiProps(uiPath('entry_modal', 'tags', 'create_new_chip'))}
                      style={[localStyles.createNewChip]}
                      onPress={() => {
                        logUI(uiPath('entry_modal', 'tags', 'create_new_chip'), 'press');
                        void handleCreateFromSearch();
                      }}
                    >
                      <Icon name="Plus" size={11} color="#53E3A6" />
                      <Text style={localStyles.createNewText}>Create "{tagSearchQuery}"</Text>
                    </TouchableOpacity>
                  ) : (
                    filteredTags.map((tag) => (
                      <TouchableOpacity
                        {...uiProps(uiPath('entry_modal', 'tags', 'chip', tag.id))}
                        key={tag.id}
                        style={[
                          styles.modalChip,
                          { flexDirection: 'row', alignItems: 'center', gap: 4 },
                          tag.color ? { borderColor: tag.color } : undefined,
                          entryTagIds.includes(tag.id) ? [styles.modalChipActive, tag.color ? { backgroundColor: `${tag.color}22` } : undefined] : undefined,
                        ]}
                        onPress={() => {
                          logUI(uiPath('entry_modal', 'tags', 'chip', tag.id), 'press');
                          toggleTag(tag.id);
                        }}
                      >
                        {tag.icon ? <Icon name={tag.icon as any} size={11} color={tag.color ?? '#EAF3FF'} /> : null}
                        <Text style={[styles.modalChipText, { fontSize: 13 }, tag.color ? { color: tag.color } : undefined]}>#{tag.name}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
            {/* 5. Numpad */}
            <NumpadGrid
              keys={[...ENTRY_KEYS]}
              onPress={appendNumpad}
              flashColor={amountColor}
              screen="entry_modal"
            />
          </ScrollView>

          {/* Bottom bar — category-aware CTA */}
          <View style={bottomBarStyles.bottomBar}>
            {editingTransactionId && onDelete && (
              <TouchableOpacity
                {...uiProps(uiPath('entry_modal', 'actions', 'delete_button'))}
                style={bottomBarStyles.deleteBtn}
                onPress={() => {
                  logUI(uiPath('entry_modal', 'actions', 'delete_button'), 'press');
                  confirmDelete();
                }}
                disabled={saving}
              >
                <Icon name="Trash2" size={20} color="#f87171" />
              </TouchableOpacity>
            )}
            {selectedCategory ? (
              <TouchableOpacity
                {...uiProps(uiPath('entry_modal', 'actions', 'cancel_button'))}
                style={bottomBarStyles.cancelBtn}
                onPress={() => {
                  logUI(uiPath('entry_modal', 'actions', 'cancel_button'), 'press');
                  setEntryCategoryId(null);
                  openCatPicker();
                }}
              >
                <Text style={bottomBarStyles.cancelText}>Reselect</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                {...uiProps(uiPath('entry_modal', 'actions', 'cancel_button'))}
                style={bottomBarStyles.cancelBtn}
                onPress={() => {
                  logUI(uiPath('entry_modal', 'actions', 'cancel_button'), 'press');
                  onClose();
                }}
              >
                <Text style={bottomBarStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
            {selectedCategory ? (
              <TouchableOpacity
                {...uiProps(uiPath('entry_modal', 'actions', 'save_button'))}
                style={bottomBarStyles.saveBtn}
                onPress={() => {
                  logUI(uiPath('entry_modal', 'actions', 'save_button'), 'press');
                  void saveEntry();
                }}
                disabled={saving}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {selectedCategory.icon
                    ? <Icon name={selectedCategory.icon as any} size={16} color="#060A14" />
                    : null}
                  <Text style={bottomBarStyles.saveText}>
                    Save to {selectedCategory.name}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                {...uiProps(uiPath('entry_modal', 'actions', 'save_button'))}
                style={bottomBarStyles.chooseCatBtn}
                onPress={() => {
                  logUI(uiPath('entry_modal', 'actions', 'save_button'), 'press');
                  openCatPicker();
                }}
              >
                <Icon name="label" size={16} color="#060A14" />
                <Text style={bottomBarStyles.saveText}>Choose Category</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ─── Embedded fullscreen category picker (swipe-up overlay) ─── */}
          <Animated.View
            {...uiProps(uiPath('entry_modal', 'category_picker', 'container'))}
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
              <TouchableOpacity
                onPress={() => {
                  logUI(uiPath('entry_modal', 'category_picker', 'close_button'), 'press');
                  closeCatPicker();
                }}
              >
                <Icon name="close" size={24} color="#8FA8C9" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.catPickerGrid} showsVerticalScrollIndicator={false}>
              {entryCategories.map((cat) => (
                <TouchableOpacity
                  {...uiProps(uiPath('entry_modal', 'category_picker', 'row', cat.id))}
                  key={cat.id}
                  ref={(r) => { catCellRefs.current[cat.id] = r as any as View; }}
                  onLayout={() => {
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
                  onPress={() => {
                    logUI(uiPath('entry_modal', 'category_picker', 'row', cat.id), 'press');
                    setEntryCategoryId(cat.id);
                    closeCatPicker();
                  }}
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
      </View>
    </Modal>
  );
});

const localStyles = StyleSheet.create({
  currencyTag: {
    color: '#8FA8C9',
    fontSize: 18,
    fontWeight: '600',
    paddingBottom: 5,
  },
  tagSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#1E3250',
    borderRadius: 999,
    backgroundColor: '#0D1B2E',
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  tagSearchInput: {
    color: '#8FA8C9',
    fontSize: 12,
    paddingVertical: 0,
    width: 82, // Matches "search tags…" text width
  },
  tagsScrollArea: {
    maxHeight: 66, // 2 rows (30px per row + 6px gap)
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  createNewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#53E3A6',
    borderRadius: 999,
    backgroundColor: '#0a2820',
  },
  createNewText: {
    color: '#53E3A6',
    fontSize: 13,
    fontWeight: '600',
  },
  newTagInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#1E3250',
    borderRadius: 999,
    backgroundColor: '#0D1B2E',
    marginBottom: 6,
  },
  newTagInput: {
    color: '#8FA8C9',
    fontSize: 12,
    minWidth: 60,
    maxWidth: 110,
    paddingVertical: 0,
  },
  newTagAdd: {
    color: '#53E3A6',
    fontSize: 12,
    fontWeight: '700',
  },
});

const bottomBarStyles = StyleSheet.create({
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#060A14',
    borderTopWidth: 1,
    borderTopColor: '#1E2F49',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#13253B',
    borderWidth: 1,
    borderColor: '#2C4669',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  deleteBtn: {
    width: 52,
    backgroundColor: '#200a0a',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  cancelText: {
    color: '#8FA8C9',
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#53E3A6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  chooseCatBtn: {
    flex: 2,
    backgroundColor: '#53E3A6',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  saveText: {
    color: '#060A14',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default EntryModal;
