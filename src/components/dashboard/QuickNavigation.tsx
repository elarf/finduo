import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { User } from '@supabase/supabase-js';
import Icon from '../Icon';
import { styles } from '../../screens/DashboardScreen.styles';
import type {
  AppAccount,
  AppCategory,
  AppTag,
  AccountSetting,
  IntervalKey,
  TransactionType,
} from '../../types/dashboard';

type QuickNavigationProps = {
  visible: boolean;
  onClose: () => void;

  // User
  user: User | null;
  signOut: () => void;

  // Navigation
  navigation: any;

  // Accounts
  accounts: AppAccount[];
  primaryAccountId: string | null;
  excludedAccountIds: string[];
  accountSettings: Record<string, AccountSetting>;
  menuAccountsExpanded: boolean;
  setMenuAccountsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  menuAccountsEditMode: boolean;
  setMenuAccountsEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedAccountId: (id: string | null) => void;
  moveAccount: (idx: number, dir: 'up' | 'down') => void;
  setPrimary: (id: string) => void;
  toggleAccountExclusion: (id: string) => void;
  openCreateAccount: () => void;
  openEditAccount: (account: AppAccount) => void;
  deleteAccount: (account: AppAccount) => Promise<void>;

  // Categories
  categories: AppCategory[];
  selectedCategories: AppCategory[];
  hiddenCategoryIds: Set<string>;
  menuIncomeCatExpanded: boolean;
  setMenuIncomeCatExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  menuIncomeCatEditMode: boolean;
  setMenuIncomeCatEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  menuExpenseCatExpanded: boolean;
  setMenuExpenseCatExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  menuExpenseCatEditMode: boolean;
  setMenuExpenseCatEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  openEntryModal: (type: TransactionType, categoryId?: string | null) => void;
  toggleCategoryHidden: (id: string) => Promise<void>;
  setEditingCategoryId: (id: string | null) => void;
  setCategoryName: (v: string) => void;
  setCategoryType: (v: TransactionType) => void;
  setCategoryColor: (v: string | null) => void;
  setCategoryIcon: (v: string | null) => void;
  setCategoryTagIds: React.Dispatch<React.SetStateAction<string[]>>;
  setShowCategoryModal: (v: boolean) => void;
  deleteCategory: (id: string) => Promise<void>;

  // Tags
  selectedTags: AppTag[];
  menuTagsExpanded: boolean;
  setMenuTagsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  menuTagsEditMode: boolean;
  setMenuTagsEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  openCreateTag: () => void;
  openEditTag: (tag: AppTag) => void;
  deleteTag: (id: string) => Promise<void>;
  selectedTagFilter: string | null;
  onFilterTag: (id: string) => void;

  // Interval
  interval: IntervalKey;
  setInterval: (v: IntervalKey) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;

  // Debts badge
  pendingDebtCount: number;

  // Other modals
  setShowFriendsModal: (v: boolean) => void;
  openInvitationsModal: () => Promise<void>;
  reloadDashboard: () => Promise<void>;
  onFilterTransfers: () => void;
};

function QuickNavigation({
  visible, onClose,
  user, signOut,
  navigation,
  accounts, primaryAccountId, excludedAccountIds, accountSettings,
  menuAccountsExpanded, setMenuAccountsExpanded,
  menuAccountsEditMode, setMenuAccountsEditMode,
  setSelectedAccountId, moveAccount, setPrimary, toggleAccountExclusion,
  openCreateAccount, openEditAccount, deleteAccount,
  categories, selectedCategories, hiddenCategoryIds,
  menuIncomeCatExpanded, setMenuIncomeCatExpanded,
  menuIncomeCatEditMode, setMenuIncomeCatEditMode,
  menuExpenseCatExpanded, setMenuExpenseCatExpanded,
  menuExpenseCatEditMode, setMenuExpenseCatEditMode,
  openEntryModal, toggleCategoryHidden,
  setEditingCategoryId, setCategoryName, setCategoryType,
  setCategoryColor, setCategoryIcon, setCategoryTagIds,
  setShowCategoryModal, deleteCategory,
  selectedTags,
  menuTagsExpanded, setMenuTagsExpanded,
  menuTagsEditMode, setMenuTagsEditMode,
  openCreateTag, openEditTag, deleteTag,
  selectedTagFilter, onFilterTag,
  interval, setInterval, customStart, setCustomStart, customEnd, setCustomEnd,
  pendingDebtCount,
  setShowFriendsModal, openInvitationsModal, reloadDashboard,
  onFilterTransfers,
}: QuickNavigationProps) {
  const [deletingCategoryIds, setDeletingCategoryIds] = useState<Set<string>>(new Set());
  const [showExperimental, setShowExperimental] = useState(false);

  const handleDeleteCategory = useCallback((categoryId: string) => {
    setDeletingCategoryIds((prev) => new Set([...prev, categoryId]));
    void (async () => {
      try {
        await deleteCategory(categoryId);
      } finally {
        setDeletingCategoryIds((prev) => {
          const next = new Set(prev);
          next.delete(categoryId);
          return next;
        });
      }
    })();
  }, [deleteCategory]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.menuOverlay}>
        <Pressable style={styles.menuOverlayTapArea} onPress={onClose} />
        <View style={styles.menuPanel}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuScrollContent}>
            <Text style={styles.menuTitle}>Quick Navigation</Text>

            {/* ── Accounts ── */}
            <View style={styles.menuSectionHeader}>
              <TouchableOpacity onPress={() => setMenuAccountsExpanded((prev) => !prev)}>
                <Text style={styles.menuSectionTitle}>Accounts {menuAccountsExpanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {menuAccountsExpanded && (
                  <TouchableOpacity style={[styles.menuIconAction, menuAccountsEditMode && { backgroundColor: '#2C4669' }]} onPress={() => setMenuAccountsEditMode((p) => !p)}>
                    <Text style={styles.manageIconText}>✎</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.menuIconAction} onPress={() => {
                  onClose();
                  openCreateAccount();
                }}>
                  <Text style={styles.menuIconActionText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>
            {menuAccountsExpanded && accounts.map((account, accountIdx) => {
              const isOwned = account.created_by === user?.id;
              const isPrimary = account.id === primaryAccountId;
              return (
                <View key={account.id} style={styles.manageRow}>
                  {!menuAccountsEditMode && account.icon && (
                    <Icon name={account.icon as any} size={36} color="#8FA8C9" />
                  )}
                  <TouchableOpacity
                    style={styles.managePrimary}
                    onPress={() => {
                      setSelectedAccountId(account.id);
                      onClose();
                    }}
                  >
                    <View style={styles.manageNameRow}>
                      {isPrimary && <Text style={styles.managePrimaryBadge}>★ </Text>}
                      <Text style={styles.manageTitle}>{account.name}</Text>
                    </View>
                    <Text style={styles.manageMeta}>
                      {account.currency}
                      {' • '}
                      {excludedAccountIds.includes(account.id) ? 'Excluded' : 'Included'}
                      {' • '}
                      {(accountSettings[account.id]?.carry_over_balance ?? true) ? 'Carry over' : 'No carry over'}
                    </Text>
                  </TouchableOpacity>

                  {menuAccountsEditMode && (
                    <>
                      {/* Reorder up */}
                      <TouchableOpacity
                        style={[styles.manageSmallButton, accountIdx === 0 && styles.manageSmallButtonDisabled]}
                        onPress={() => moveAccount(accountIdx, 'up')}
                        disabled={accountIdx === 0}
                      >
                        <Text style={styles.manageSmallText}>↑</Text>
                      </TouchableOpacity>

                      {/* Reorder down */}
                      <TouchableOpacity
                        style={[styles.manageSmallButton, accountIdx === accounts.length - 1 && styles.manageSmallButtonDisabled]}
                        onPress={() => moveAccount(accountIdx, 'down')}
                        disabled={accountIdx === accounts.length - 1}
                      >
                        <Text style={styles.manageSmallText}>↓</Text>
                      </TouchableOpacity>

                      {/* Set as primary */}
                      <TouchableOpacity
                        style={[styles.manageSmallButton, isPrimary && styles.manageSmallButtonActive]}
                        onPress={() => setPrimary(account.id)}
                      >
                        <Text style={[styles.manageSmallText, isPrimary && styles.manageSmallTextActive]}>★</Text>
                      </TouchableOpacity>

                      {/* Include/exclude from overview */}
                      <TouchableOpacity
                        style={[styles.manageSmallButton, excludedAccountIds.includes(account.id) && styles.manageSmallButtonActive]}
                        onPress={() => toggleAccountExclusion(account.id)}
                      >
                        <Text style={[styles.manageSmallText, excludedAccountIds.includes(account.id) && { color: '#f87171' }]}>
                          {excludedAccountIds.includes(account.id) ? '⊘' : '◉'}
                        </Text>
                      </TouchableOpacity>

                      {isOwned ? (
                        <>
                          <TouchableOpacity style={styles.manageIconButton} onPress={() => {
                            onClose();
                            openEditAccount(account);
                          }}>
                            <Text style={styles.manageIconText}>✎</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.manageIconButtonDanger} onPress={() => {
                            if (Platform.OS === 'web') {
                              if (window.confirm(`Remove ${account.name}? This will delete all transactions, categories, and tags for this account.`)) {
                                onClose();
                                void deleteAccount(account);
                              }
                            } else {
                              Alert.alert('Remove account', `Remove ${account.name}?`, [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Remove',
                                  style: 'destructive',
                                  onPress: () => {
                                    onClose();
                                    void deleteAccount(account);
                                  },
                                },
                              ]);
                            }
                          }}>
                            <Text style={styles.manageIconText}>✕</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <Text style={styles.managePill}>Shared</Text>
                      )}
                    </>
                  )}
                </View>
              );
            })}

            {/* ── Income Categories ── */}
            <View style={styles.menuSectionHeader}>
              <TouchableOpacity onPress={() => setMenuIncomeCatExpanded((prev) => !prev)}>
                <Text style={[styles.menuSectionTitle, { color: '#4ade80' }]}>Income {menuIncomeCatExpanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {menuIncomeCatExpanded && (
                  <TouchableOpacity style={[styles.menuIconAction, menuIncomeCatEditMode && { backgroundColor: '#2C4669' }]} onPress={() => setMenuIncomeCatEditMode((p) => !p)}>
                    <Text style={styles.manageIconText}>✎</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.menuIconAction} onPress={() => {
                  onClose();
                  setEditingCategoryId(null);
                  setCategoryName('');
                  setCategoryType('income');
                  setCategoryColor(null);
                  setCategoryIcon(null);
                  setCategoryTagIds([]);
                  setShowCategoryModal(true);
                }}>
                  <Text style={styles.menuIconActionText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>
            {menuIncomeCatExpanded && (menuIncomeCatEditMode ? categories : selectedCategories).filter((c) => c.type === 'income' && c.name !== 'Transfer').map((category) => {
              const isHidden = hiddenCategoryIds.has(category.id);
              const catColor = isHidden ? '#475569' : (category.color ?? '#4ade80');
              const isMine = category.user_id === user?.id;
              const isDeleting = deletingCategoryIds.has(category.id);
              return (
                <View key={category.id} style={[styles.manageRow, isDeleting && { opacity: 0.4 }]} pointerEvents={isDeleting ? 'none' : 'auto'}>
                  <TouchableOpacity style={styles.managePrimary} onPress={() => { onClose(); openEntryModal(category.type, category.id); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {category.icon ? <Icon name={category.icon as any} size={16} color={catColor} /> : null}
                      <Text style={[styles.manageTitle, { color: catColor }]}>{category.name}</Text>
                      {!isMine && <Text style={{ color: '#64748B', fontSize: 10 }}>shared</Text>}
                    </View>
                  </TouchableOpacity>
                  {menuIncomeCatEditMode && (
                    <>
                      <TouchableOpacity style={styles.manageIconButton} onPress={() => void toggleCategoryHidden(category.id)}>
                        <Icon name={hiddenCategoryIds.has(category.id) ? 'EyeOff' : 'Eye'} size={14} color="#94a3b8" />
                      </TouchableOpacity>
                      {isMine && (
                        <TouchableOpacity style={styles.manageIconButton} onPress={() => {
                          onClose();
                          setEditingCategoryId(category.id);
                          setCategoryName(category.name);
                          setCategoryType(category.type);
                          setCategoryColor(category.color ?? null);
                          setCategoryIcon(category.icon ?? null);
                          setCategoryTagIds((category.tag_ids ?? []) as string[]);
                          setShowCategoryModal(true);
                        }}>
                          <Text style={styles.manageIconText}>✎</Text>
                        </TouchableOpacity>
                      )}
                      {isMine && (
                        <TouchableOpacity style={styles.manageIconButtonDanger} onPress={() => {
                          if (Platform.OS === 'web') {
                            if (window.confirm(`Remove ${category.name}?`)) { handleDeleteCategory(category.id); }
                          } else {
                            Alert.alert('Remove category', `Remove ${category.name}?`, [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Remove', style: 'destructive', onPress: () => { handleDeleteCategory(category.id); } },
                            ]);
                          }
                        }}>
                          <Text style={styles.manageIconText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              );
            })}

            {/* ── Expense Categories ── */}
            <View style={styles.menuSectionHeader}>
              <TouchableOpacity onPress={() => setMenuExpenseCatExpanded((prev) => !prev)}>
                <Text style={[styles.menuSectionTitle, { color: '#f87171' }]}>Expense {menuExpenseCatExpanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {menuExpenseCatExpanded && (
                  <TouchableOpacity style={[styles.menuIconAction, menuExpenseCatEditMode && { backgroundColor: '#2C4669' }]} onPress={() => setMenuExpenseCatEditMode((p) => !p)}>
                    <Text style={styles.manageIconText}>✎</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.menuIconAction} onPress={() => {
                  onClose();
                  setEditingCategoryId(null);
                  setCategoryName('');
                  setCategoryType('expense');
                  setCategoryColor(null);
                  setCategoryIcon(null);
                  setCategoryTagIds([]);
                  setShowCategoryModal(true);
                }}>
                  <Text style={styles.menuIconActionText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>
            {menuExpenseCatExpanded && (menuExpenseCatEditMode ? categories : selectedCategories).filter((c) => c.type === 'expense' && c.name !== 'Transfer').map((category) => {
              const isHidden = hiddenCategoryIds.has(category.id);
              const catColor = isHidden ? '#475569' : (category.color ?? '#f87171');
              const isMine = category.user_id === user?.id;
              const isDeleting = deletingCategoryIds.has(category.id);
              return (
                <View key={category.id} style={[styles.manageRow, isDeleting && { opacity: 0.4 }]} pointerEvents={isDeleting ? 'none' : 'auto'}>
                  <TouchableOpacity style={styles.managePrimary} onPress={() => { onClose(); openEntryModal(category.type, category.id); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {category.icon ? <Icon name={category.icon as any} size={16} color={catColor} /> : null}
                      <Text style={[styles.manageTitle, { color: catColor }]}>{category.name}</Text>
                      {!isMine && <Text style={{ color: '#64748B', fontSize: 10 }}>shared</Text>}
                    </View>
                  </TouchableOpacity>
                  {menuExpenseCatEditMode && (
                    <>
                      <TouchableOpacity style={styles.manageIconButton} onPress={() => void toggleCategoryHidden(category.id)}>
                        <Icon name={hiddenCategoryIds.has(category.id) ? 'EyeOff' : 'Eye'} size={14} color="#94a3b8" />
                      </TouchableOpacity>
                      {isMine && (
                        <TouchableOpacity style={styles.manageIconButton} onPress={() => {
                          onClose();
                          setEditingCategoryId(category.id);
                          setCategoryName(category.name);
                          setCategoryType(category.type);
                          setCategoryColor(category.color ?? null);
                          setCategoryIcon(category.icon ?? null);
                          setCategoryTagIds((category.tag_ids ?? []) as string[]);
                          setShowCategoryModal(true);
                        }}>
                          <Text style={styles.manageIconText}>✎</Text>
                        </TouchableOpacity>
                      )}
                      {isMine && (
                        <TouchableOpacity style={styles.manageIconButtonDanger} onPress={() => {
                          if (Platform.OS === 'web') {
                            if (window.confirm(`Remove ${category.name}?`)) { handleDeleteCategory(category.id); }
                          } else {
                            Alert.alert('Remove category', `Remove ${category.name}?`, [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Remove', style: 'destructive', onPress: () => { handleDeleteCategory(category.id); } },
                            ]);
                          }
                        }}>
                          <Text style={styles.manageIconText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              );
            })}

            {/* ── Transfers ── */}
            <TouchableOpacity style={styles.menuSectionHeader} onPress={onFilterTransfers}>
              <Text style={[styles.menuSectionTitle, { color: '#a855f7' }]}>↔ Transfers</Text>
            </TouchableOpacity>

            {/* ── Tags ── */}
            <View style={styles.menuSectionHeader}>
              <TouchableOpacity onPress={() => setMenuTagsExpanded((prev) => !prev)}>
                <Text style={styles.menuSectionTitle}>Tags {menuTagsExpanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {menuTagsExpanded && (
                  <TouchableOpacity style={[styles.menuIconAction, menuTagsEditMode && { backgroundColor: '#2C4669' }]} onPress={() => setMenuTagsEditMode((p) => !p)}>
                    <Text style={styles.manageIconText}>✎</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.menuIconAction} onPress={() => {
                  onClose();
                  openCreateTag();
                }}>
                  <Text style={styles.menuIconActionText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>
            {menuTagsExpanded && selectedTags.map((tag) => {
              const isActive = selectedTagFilter === tag.id;
              const tagColor = tag.color ?? '#8FA8C9';
              return (
              <View key={tag.id} style={[styles.manageRow, isActive && { backgroundColor: '#0D2137', borderRadius: 6 }]}>
                <TouchableOpacity style={styles.managePrimary} onPress={() => { onFilterTag(tag.id); onClose(); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {tag.icon ? <Icon name={tag.icon as any} size={16} color={tagColor} /> : null}
                    <Text style={[styles.manageTitle, { color: isActive ? tagColor : (tag.color ?? undefined) }]}>#{tag.name}</Text>
                    {isActive && <Icon name="Filter" size={12} color={tagColor} />}
                  </View>
                </TouchableOpacity>
                {menuTagsEditMode && (
                  <>
                    <TouchableOpacity style={styles.manageIconButton} onPress={() => {
                      onClose();
                      openEditTag(tag);
                    }}>
                      <Text style={styles.manageIconText}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.manageIconButtonDanger} onPress={() => {
                      if (Platform.OS === 'web') {
                        if (window.confirm(`Remove #${tag.name}?`)) { void deleteTag(tag.id); }
                      } else {
                        Alert.alert('Remove tag', `Remove #${tag.name}?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => { void deleteTag(tag.id); } },
                        ]);
                      }
                    }}>
                      <Text style={styles.manageIconText}>✕</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
              );
            })}

            {/* ── Interval ── */}
            <Text style={styles.menuSectionTitle}>Interval</Text>
            <View style={styles.menuChipWrap}>
              {(['day', 'week', 'month', 'year', 'all', 'custom'] as IntervalKey[]).map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.menuChip, interval === key && styles.menuChipActive]}
                  onPress={() => setInterval(key)}
                >
                  <Text style={styles.menuChipText}>{key.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {interval === 'custom' && (
              <View style={styles.customRangeStack}>
                <TextInput
                  value={customStart}
                  onChangeText={setCustomStart}
                  placeholder="Start YYYY-MM-DD"
                  placeholderTextColor="#64748B"
                  style={styles.input}
                />
                <TextInput
                  value={customEnd}
                  onChangeText={setCustomEnd}
                  placeholder="End YYYY-MM-DD"
                  placeholderTextColor="#64748B"
                  style={styles.input}
                />
              </View>
            )}

            {/* ── Navigation links ── */}
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              onClose();
              setShowFriendsModal(true);
            }}>
              <Text style={styles.menuItemText}>Friends</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowExperimental((p) => !p)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.menuItemText}>Experimental</Text>
                <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '600' }}>⚗ {showExperimental ? '▾' : '▸'}</Text>
              </View>
            </TouchableOpacity>
            {showExperimental && (
              <>
                <TouchableOpacity style={[styles.menuItem, { paddingLeft: 20 }]} onPress={() => {
                  onClose();
                  navigation.navigate('Lending');
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="Banknote" size={18} color="#EAF2FF" />
                    <Text style={styles.menuItemText}>Lending</Text>
                    {pendingDebtCount > 0 && (
                      <View style={{ backgroundColor: '#f87171', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{pendingDebtCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuItem, { paddingLeft: 20 }]} onPress={() => {
                  onClose();
                  navigation.navigate('Settlements');
                }}>
                  <Text style={styles.menuItemText}>Settlements</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuItem, { paddingLeft: 20 }]} onPress={() => {
                  onClose();
                  navigation.navigate('Pools');
                }}>
                  <Text style={styles.menuItemText}>Pools</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuItem, { paddingLeft: 20 }]} onPress={() => {
                  onClose();
                  void openInvitationsModal();
                }}>
                  <Text style={styles.menuItemText}>Invitations</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              onClose();
              if (Platform.OS === 'web') {
                (window as any).location.reload();
              } else {
                void reloadDashboard();
              }
            }}>
              <Text style={styles.menuItemText}>Reload app</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuDanger} onPress={signOut}>
              <Text style={styles.menuDangerText}>Sign out</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default React.memo(QuickNavigation);
