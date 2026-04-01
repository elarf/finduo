import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
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
import { uiPath, uiProps, logUI } from '../../lib/devtools';
import ChangelogModal from './ChangelogModal';

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

  // Interval visibility (Quick Nav only controls which options are visible)
  intervalVisibility: Record<IntervalKey, boolean>;
  setIntervalVisibility: (v: Record<IntervalKey, boolean>) => void;

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
  intervalVisibility, setIntervalVisibility,
  pendingDebtCount,
  setShowFriendsModal, openInvitationsModal, reloadDashboard,
  onFilterTransfers,
}: QuickNavigationProps) {
  const [deletingCategoryIds, setDeletingCategoryIds] = useState<Set<string>>(new Set());
  const [showExperimental, setShowExperimental] = useState(false);
  const [showIntervalVisibility, setShowIntervalVisibility] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    logUI(uiPath('quick_nav', 'panel', 'container'), 'mount');
  }, []);

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
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View {...uiProps(uiPath('quick_nav', 'panel', 'container'))} style={styles.menuOverlay}>
        <Pressable
          {...uiProps(uiPath('quick_nav', 'panel', 'close_area'))}
          style={styles.menuOverlayTapArea}
          onPress={() => {
            logUI(uiPath('quick_nav', 'panel', 'close_area'), 'press');
            onClose();
          }}
        />
        <View style={styles.menuPanel}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuScrollContent}>
            <Text style={styles.menuTitle}>Quick Navigation</Text>

            {/* ── Accounts ── */}
            <View {...uiProps(uiPath('quick_nav', 'accounts', 'section_header'))} style={styles.menuSectionHeader}>
              <TouchableOpacity
                onPress={() => {
                  logUI(uiPath('quick_nav', 'accounts', 'section_header'), 'press');
                  setMenuAccountsExpanded((prev) => !prev);
                }}
              >
                <Text style={styles.menuSectionTitle}>Accounts {menuAccountsExpanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {menuAccountsExpanded && (
                  <TouchableOpacity
                    style={[styles.menuIconAction, menuAccountsEditMode && { backgroundColor: '#2C4669' }]}
                    onPress={() => {
                      logUI(uiPath('quick_nav', 'accounts', 'edit_mode_toggle'), 'press');
                      setMenuAccountsEditMode((p) => !p);
                    }}
                  >
                    <Text style={styles.manageIconText}>✎</Text>
                  </TouchableOpacity>
                )}
                {(menuAccountsExpanded || accounts.length === 0) && (
                  <TouchableOpacity
                    {...uiProps(uiPath('quick_nav', 'accounts', 'add_button'))}
                    style={styles.menuIconAction}
                    onPress={() => {
                      logUI(uiPath('quick_nav', 'accounts', 'add_button'), 'press');
                      onClose();
                      openCreateAccount();
                    }}
                  >
                    <Text style={styles.menuIconActionText}>＋</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {menuAccountsExpanded && accounts.map((account, accountIdx) => {
              const isOwned = account.created_by === user?.id;
              const isPrimary = account.id === primaryAccountId;
              return (
                <View
                  {...uiProps(uiPath('quick_nav', 'accounts', 'row', account.id))}
                  key={account.id}
                  style={styles.manageRow}
                >
                  {!menuAccountsEditMode && account.icon && (
                    <Icon name={account.icon as any} size={36} color="#8FA8C9" />
                  )}
                  <TouchableOpacity
                    style={styles.managePrimary}
                    onPress={() => {
                      logUI(uiPath('quick_nav', 'accounts', 'row', account.id), 'press');
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
                        onPress={() => {
                          logUI(uiPath('quick_nav', 'accounts', 'move_up_button', account.id), 'press');
                          moveAccount(accountIdx, 'up');
                        }}
                        disabled={accountIdx === 0}
                      >
                        <Text style={styles.manageSmallText}>↑</Text>
                      </TouchableOpacity>

                      {/* Reorder down */}
                      <TouchableOpacity
                        style={[styles.manageSmallButton, accountIdx === accounts.length - 1 && styles.manageSmallButtonDisabled]}
                        onPress={() => {
                          logUI(uiPath('quick_nav', 'accounts', 'move_down_button', account.id), 'press');
                          moveAccount(accountIdx, 'down');
                        }}
                        disabled={accountIdx === accounts.length - 1}
                      >
                        <Text style={styles.manageSmallText}>↓</Text>
                      </TouchableOpacity>

                      {/* Set as primary */}
                      <TouchableOpacity
                        {...uiProps(uiPath('quick_nav', 'accounts', 'primary_button', account.id))}
                        style={[styles.manageSmallButton, isPrimary && styles.manageSmallButtonActive]}
                        onPress={() => {
                          logUI(uiPath('quick_nav', 'accounts', 'primary_button', account.id), 'press');
                          setPrimary(account.id);
                        }}
                      >
                        <Text style={[styles.manageSmallText, isPrimary && styles.manageSmallTextActive]}>★</Text>
                      </TouchableOpacity>

                      {/* Include/exclude from overview */}
                      <TouchableOpacity
                        {...uiProps(uiPath('quick_nav', 'accounts', 'include_toggle', account.id))}
                        style={[styles.manageSmallButton, excludedAccountIds.includes(account.id) && styles.manageSmallButtonActive]}
                        onPress={() => {
                          logUI(uiPath('quick_nav', 'accounts', 'include_toggle', account.id), 'press');
                          toggleAccountExclusion(account.id);
                        }}
                      >
                        <Text style={[styles.manageSmallText, excludedAccountIds.includes(account.id) && { color: '#f87171' }]}>
                          {excludedAccountIds.includes(account.id) ? '⊘' : '◉'}
                        </Text>
                      </TouchableOpacity>

                      {isOwned ? (
                        <>
                          <TouchableOpacity
                            {...uiProps(uiPath('quick_nav', 'accounts', 'edit_button', account.id))}
                            style={styles.manageIconButton}
                            onPress={() => {
                              logUI(uiPath('quick_nav', 'accounts', 'edit_button', account.id), 'press');
                              onClose();
                              openEditAccount(account);
                            }}
                          >
                            <Text style={styles.manageIconText}>✎</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            {...uiProps(uiPath('quick_nav', 'accounts', 'delete_button', account.id))}
                            style={styles.manageIconButtonDanger}
                            onPress={() => {
                              logUI(uiPath('quick_nav', 'accounts', 'delete_button', account.id), 'press');
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
                            }}
                          >
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
            <View {...uiProps(uiPath('quick_nav', 'income_cats', 'section_header'))} style={styles.menuSectionHeader}>
              <TouchableOpacity
                onPress={() => {
                  logUI(uiPath('quick_nav', 'income_cats', 'section_header'), 'press');
                  setMenuIncomeCatExpanded((prev) => !prev);
                }}
              >
                <Text style={[styles.menuSectionTitle, { color: '#4ade80' }]}>Income {menuIncomeCatExpanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {menuIncomeCatExpanded && (
                  <TouchableOpacity
                    style={[styles.menuIconAction, menuIncomeCatEditMode && { backgroundColor: '#2C4669' }]}
                    onPress={() => {
                      logUI(uiPath('quick_nav', 'income_cats', 'edit_mode_toggle'), 'press');
                      setMenuIncomeCatEditMode((p) => !p);
                    }}
                  >
                    <Text style={styles.manageIconText}>✎</Text>
                  </TouchableOpacity>
                )}
                {(menuIncomeCatExpanded || !categories.some((c) => c.type === 'income' && c.name !== 'Transfer')) && (
                  <TouchableOpacity
                    {...uiProps(uiPath('quick_nav', 'income_cats', 'add_button'))}
                    style={styles.menuIconAction}
                    onPress={() => {
                      logUI(uiPath('quick_nav', 'income_cats', 'add_button'), 'press');
                      onClose();
                      setEditingCategoryId(null);
                      setCategoryName('');
                      setCategoryType('income');
                      setCategoryColor(null);
                      setCategoryIcon(null);
                      setCategoryTagIds([]);
                      setShowCategoryModal(true);
                    }}
                  >
                    <Text style={styles.menuIconActionText}>＋</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {menuIncomeCatExpanded && (menuIncomeCatEditMode ? categories : selectedCategories).filter((c) => c.type === 'income' && c.name !== 'Transfer').map((category) => {
              const isHidden = hiddenCategoryIds.has(category.id);
              const catColor = isHidden ? '#475569' : (category.color ?? '#4ade80');
              const isMine = category.user_id === user?.id;
              const isDeleting = deletingCategoryIds.has(category.id);
              return (
                <View
                  {...uiProps(uiPath('quick_nav', 'income_cats', 'row', category.id))}
                  key={category.id}
                  style={[styles.manageRow, isDeleting && { opacity: 0.4 }]}
                  pointerEvents={isDeleting ? 'none' : 'auto'}
                >
                  <TouchableOpacity
                    style={styles.managePrimary}
                    onPress={() => {
                      logUI(uiPath('quick_nav', 'income_cats', 'row', category.id), 'press');
                      onClose();
                      openEntryModal(category.type, category.id);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {category.icon ? <Icon name={category.icon as any} size={16} color={catColor} /> : null}
                      <Text style={[styles.manageTitle, { color: catColor }]}>{category.name}</Text>
                      {!isMine && <Text style={{ color: '#64748B', fontSize: 10 }}>shared</Text>}
                    </View>
                  </TouchableOpacity>
                  {menuIncomeCatEditMode && (
                    <>
                      <TouchableOpacity
                        style={styles.manageIconButton}
                        onPress={() => {
                          logUI(uiPath('quick_nav', 'income_cats', 'visibility_toggle', category.id), 'press');
                          void toggleCategoryHidden(category.id);
                        }}
                      >
                        <Icon name={hiddenCategoryIds.has(category.id) ? 'EyeOff' : 'Eye'} size={14} color="#94a3b8" />
                      </TouchableOpacity>
                      {isMine && (
                        <TouchableOpacity
                          style={styles.manageIconButton}
                          onPress={() => {
                            logUI(uiPath('quick_nav', 'income_cats', 'edit_button', category.id), 'press');
                            onClose();
                            setEditingCategoryId(category.id);
                            setCategoryName(category.name);
                            setCategoryType(category.type);
                            setCategoryColor(category.color ?? null);
                            setCategoryIcon(category.icon ?? null);
                            setCategoryTagIds((category.tag_ids ?? []) as string[]);
                            setShowCategoryModal(true);
                          }}
                        >
                          <Text style={styles.manageIconText}>✎</Text>
                        </TouchableOpacity>
                      )}
                      {isMine && (
                        <TouchableOpacity
                          style={styles.manageIconButtonDanger}
                          onPress={() => {
                            logUI(uiPath('quick_nav', 'income_cats', 'delete_button', category.id), 'press');
                            if (Platform.OS === 'web') {
                              if (window.confirm(`Remove ${category.name}?`)) { handleDeleteCategory(category.id); }
                            } else {
                              Alert.alert('Remove category', `Remove ${category.name}?`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Remove', style: 'destructive', onPress: () => { handleDeleteCategory(category.id); } },
                              ]);
                            }
                          }}
                        >
                          <Text style={styles.manageIconText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              );
            })}

            {/* ── Expense Categories ── */}
            <View {...uiProps(uiPath('quick_nav', 'expense_cats', 'section_header'))} style={styles.menuSectionHeader}>
              <TouchableOpacity
                onPress={() => {
                  logUI(uiPath('quick_nav', 'expense_cats', 'section_header'), 'press');
                  setMenuExpenseCatExpanded((prev) => !prev);
                }}
              >
                <Text style={[styles.menuSectionTitle, { color: '#f87171' }]}>Expense {menuExpenseCatExpanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {menuExpenseCatExpanded && (
                  <TouchableOpacity
                    style={[styles.menuIconAction, menuExpenseCatEditMode && { backgroundColor: '#2C4669' }]}
                    onPress={() => {
                      logUI(uiPath('quick_nav', 'expense_cats', 'edit_mode_toggle'), 'press');
                      setMenuExpenseCatEditMode((p) => !p);
                    }}
                  >
                    <Text style={styles.manageIconText}>✎</Text>
                  </TouchableOpacity>
                )}
                {(menuExpenseCatExpanded || !categories.some((c) => c.type === 'expense' && c.name !== 'Transfer')) && (
                  <TouchableOpacity
                    {...uiProps(uiPath('quick_nav', 'expense_cats', 'add_button'))}
                    style={styles.menuIconAction}
                    onPress={() => {
                      logUI(uiPath('quick_nav', 'expense_cats', 'add_button'), 'press');
                      onClose();
                      setEditingCategoryId(null);
                      setCategoryName('');
                      setCategoryType('expense');
                      setCategoryColor(null);
                      setCategoryIcon(null);
                      setCategoryTagIds([]);
                      setShowCategoryModal(true);
                    }}
                  >
                    <Text style={styles.menuIconActionText}>＋</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {menuExpenseCatExpanded && (menuExpenseCatEditMode ? categories : selectedCategories).filter((c) => c.type === 'expense' && c.name !== 'Transfer').map((category) => {
              const isHidden = hiddenCategoryIds.has(category.id);
              const catColor = isHidden ? '#475569' : (category.color ?? '#f87171');
              const isMine = category.user_id === user?.id;
              const isDeleting = deletingCategoryIds.has(category.id);
              return (
                <View
                  {...uiProps(uiPath('quick_nav', 'expense_cats', 'row', category.id))}
                  key={category.id}
                  style={[styles.manageRow, isDeleting && { opacity: 0.4 }]}
                  pointerEvents={isDeleting ? 'none' : 'auto'}
                >
                  <TouchableOpacity
                    style={styles.managePrimary}
                    onPress={() => {
                      logUI(uiPath('quick_nav', 'expense_cats', 'row', category.id), 'press');
                      onClose();
                      openEntryModal(category.type, category.id);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {category.icon ? <Icon name={category.icon as any} size={16} color={catColor} /> : null}
                      <Text style={[styles.manageTitle, { color: catColor }]}>{category.name}</Text>
                      {!isMine && <Text style={{ color: '#64748B', fontSize: 10 }}>shared</Text>}
                    </View>
                  </TouchableOpacity>
                  {menuExpenseCatEditMode && (
                    <>
                      <TouchableOpacity
                        style={styles.manageIconButton}
                        onPress={() => {
                          logUI(uiPath('quick_nav', 'expense_cats', 'visibility_toggle', category.id), 'press');
                          void toggleCategoryHidden(category.id);
                        }}
                      >
                        <Icon name={hiddenCategoryIds.has(category.id) ? 'EyeOff' : 'Eye'} size={14} color="#94a3b8" />
                      </TouchableOpacity>
                      {isMine && (
                        <TouchableOpacity
                          style={styles.manageIconButton}
                          onPress={() => {
                            logUI(uiPath('quick_nav', 'expense_cats', 'edit_button', category.id), 'press');
                            onClose();
                            setEditingCategoryId(category.id);
                            setCategoryName(category.name);
                            setCategoryType(category.type);
                            setCategoryColor(category.color ?? null);
                            setCategoryIcon(category.icon ?? null);
                            setCategoryTagIds((category.tag_ids ?? []) as string[]);
                            setShowCategoryModal(true);
                          }}
                        >
                          <Text style={styles.manageIconText}>✎</Text>
                        </TouchableOpacity>
                      )}
                      {isMine && (
                        <TouchableOpacity
                          style={styles.manageIconButtonDanger}
                          onPress={() => {
                            logUI(uiPath('quick_nav', 'expense_cats', 'delete_button', category.id), 'press');
                            if (Platform.OS === 'web') {
                              if (window.confirm(`Remove ${category.name}?`)) { handleDeleteCategory(category.id); }
                            } else {
                              Alert.alert('Remove category', `Remove ${category.name}?`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Remove', style: 'destructive', onPress: () => { handleDeleteCategory(category.id); } },
                              ]);
                            }
                          }}
                        >
                          <Text style={styles.manageIconText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              );
            })}

            {/* ── Transfers ── */}
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav', 'nav', 'transfers_item'))}
              style={styles.menuSectionHeader}
              onPress={() => {
                logUI(uiPath('quick_nav', 'nav', 'transfers_item'), 'press');
                onFilterTransfers();
              }}
            >
              <Text style={[styles.menuSectionTitle, { color: '#a855f7' }]}>↔ Transfers</Text>
            </TouchableOpacity>

            {/* ── Tags ── */}
            <View {...uiProps(uiPath('quick_nav', 'tags', 'section_header'))} style={styles.menuSectionHeader}>
              <TouchableOpacity
                onPress={() => {
                  logUI(uiPath('quick_nav', 'tags', 'section_header'), 'press');
                  setMenuTagsExpanded((prev) => !prev);
                }}
              >
                <Text style={styles.menuSectionTitle}>Tags {menuTagsExpanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {menuTagsExpanded && (
                  <TouchableOpacity
                    style={[styles.menuIconAction, menuTagsEditMode && { backgroundColor: '#2C4669' }]}
                    onPress={() => {
                      logUI(uiPath('quick_nav', 'tags', 'edit_mode_toggle'), 'press');
                      setMenuTagsEditMode((p) => !p);
                    }}
                  >
                    <Text style={styles.manageIconText}>✎</Text>
                  </TouchableOpacity>
                )}
                {(menuTagsExpanded || selectedTags.length === 0) && (
                  <TouchableOpacity
                    {...uiProps(uiPath('quick_nav', 'tags', 'add_button'))}
                    style={styles.menuIconAction}
                    onPress={() => {
                      logUI(uiPath('quick_nav', 'tags', 'add_button'), 'press');
                      onClose();
                      openCreateTag();
                    }}
                  >
                    <Text style={styles.menuIconActionText}>＋</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {menuTagsExpanded && selectedTags.map((tag) => {
              const isActive = selectedTagFilter === tag.id;
              const tagColor = tag.color ?? '#8FA8C9';
              return (
              <View
                {...uiProps(uiPath('quick_nav', 'tags', 'row', tag.id))}
                key={tag.id}
                style={[styles.manageRow, isActive && { backgroundColor: '#0D2137', borderRadius: 6 }]}
              >
                <TouchableOpacity
                  style={styles.managePrimary}
                  onPress={() => {
                    logUI(uiPath('quick_nav', 'tags', 'row', tag.id), 'press');
                    onFilterTag(tag.id);
                    onClose();
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {tag.icon ? <Icon name={tag.icon as any} size={16} color={tagColor} /> : null}
                    <Text style={[styles.manageTitle, { color: isActive ? tagColor : (tag.color ?? undefined) }]}>#{tag.name}</Text>
                    {isActive && <Icon name="Filter" size={12} color={tagColor} />}
                  </View>
                </TouchableOpacity>
                {menuTagsEditMode && (
                  <>
                    <TouchableOpacity
                      style={styles.manageIconButton}
                      onPress={() => {
                        logUI(uiPath('quick_nav', 'tags', 'edit_button', tag.id), 'press');
                        onClose();
                        openEditTag(tag);
                      }}
                    >
                      <Text style={styles.manageIconText}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.manageIconButtonDanger}
                      onPress={() => {
                        logUI(uiPath('quick_nav', 'tags', 'delete_button', tag.id), 'press');
                        if (Platform.OS === 'web') {
                          if (window.confirm(`Remove #${tag.name}?`)) { void deleteTag(tag.id); }
                        } else {
                          Alert.alert('Remove tag', `Remove #${tag.name}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => { void deleteTag(tag.id); } },
                          ]);
                        }
                      }}
                    >
                      <Text style={styles.manageIconText}>✕</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
              );
            })}

            {/* ── Interval Visibility ── */}
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav', 'interval_visibility', 'toggle'))}
              style={styles.menuItem}
              onPress={() => {
                logUI(uiPath('quick_nav', 'interval_visibility', 'toggle'), 'press');
                setShowIntervalVisibility((p) => !p);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.menuItemText}>Visible Intervals</Text>
                <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600' }}>{showIntervalVisibility ? '▾' : '▸'}</Text>
              </View>
            </TouchableOpacity>
            {showIntervalVisibility && (['day', 'week', 'month', 'year', 'all', 'custom'] as IntervalKey[]).map((key) => (
              <TouchableOpacity
                {...uiProps(uiPath('quick_nav', 'interval_visibility', 'key', key))}
                key={key}
                style={[styles.menuItem, { paddingVertical: 6, paddingLeft: 20 }]}
                onPress={() => {
                  logUI(uiPath('quick_nav', 'interval_visibility', 'key', key), 'press');
                  setIntervalVisibility({ ...intervalVisibility, [key]: !intervalVisibility[key] });
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                  <Text style={styles.menuItemText}>{key.toUpperCase()}</Text>
                  <Text style={{ color: intervalVisibility[key] ? '#4ade80' : '#64748B', fontSize: 13, fontWeight: '700' }}>
                    {intervalVisibility[key] ? '✓' : '✕'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}


            {/* ── Navigation links ── */}
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav', 'nav', 'pools_item'))}
              style={styles.menuItem}
              onPress={() => {
                logUI(uiPath('quick_nav', 'nav', 'pools_item'), 'press');
                onClose();
                navigation.navigate('Pools');
              }}
            >
              <Text style={styles.menuItemText}>Pools</Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav', 'nav', 'friends_item'))}
              style={styles.menuItem}
              onPress={() => {
                logUI(uiPath('quick_nav', 'nav', 'friends_item'), 'press');
                onClose();
                setShowFriendsModal(true);
              }}
            >
              <Text style={styles.menuItemText}>Friends</Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav', 'nav', 'experimental_toggle'))}
              style={styles.menuItem}
              onPress={() => {
                logUI(uiPath('quick_nav', 'nav', 'experimental_toggle'), 'press');
                setShowExperimental((p) => !p);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.menuItemText}>Experimental</Text>
                <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '600' }}>⚗ {showExperimental ? '▾' : '▸'}</Text>
              </View>
            </TouchableOpacity>
            {showExperimental && (
              <>
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav', 'nav', 'lending_item'))}
                  style={[styles.menuItem, { paddingLeft: 20 }]}
                  onPress={() => {
                    logUI(uiPath('quick_nav', 'nav', 'lending_item'), 'press');
                    onClose();
                    navigation.navigate('Lending');
                  }}
                >
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
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav', 'nav', 'settlements_item'))}
                  style={[styles.menuItem, { paddingLeft: 20 }]}
                  onPress={() => {
                    logUI(uiPath('quick_nav', 'nav', 'settlements_item'), 'press');
                    onClose();
                    navigation.navigate('Settlements');
                  }}
                >
                  <Text style={styles.menuItemText}>Settlements</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav', 'nav', 'invitations_item'))}
                  style={[styles.menuItem, { paddingLeft: 20 }]}
                  onPress={() => {
                    logUI(uiPath('quick_nav', 'nav', 'invitations_item'), 'press');
                    onClose();
                    void openInvitationsModal();
                  }}
                >
                  <Text style={styles.menuItemText}>Invitations</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav', 'nav', 'changelog_item'))}
                  style={[styles.menuItem, { paddingLeft: 20 }]}
                  onPress={() => {
                    logUI(uiPath('quick_nav', 'nav', 'changelog_item'), 'press');
                    setShowChangelog(true);
                  }}
                >
                  <Text style={styles.menuItemText}>Changelogs</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav', 'nav', 'reload_button'))}
              style={styles.menuItem}
              onPress={() => {
                logUI(uiPath('quick_nav', 'nav', 'reload_button'), 'press');
                onClose();
                if (Platform.OS === 'web') {
                  (window as any).location.reload();
                } else {
                  void reloadDashboard();
                }
              }}
            >
              <Text style={styles.menuItemText}>Reload app</Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav', 'nav', 'signout_button'))}
              style={styles.menuDanger}
              onPress={() => {
                logUI(uiPath('quick_nav', 'nav', 'signout_button'), 'press');
                signOut();
              }}
            >
              <Text style={styles.menuDangerText}>Sign out</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
    <ChangelogModal visible={showChangelog} onClose={() => setShowChangelog(false)} />
    </>
  );
}

export default React.memo(QuickNavigation);
