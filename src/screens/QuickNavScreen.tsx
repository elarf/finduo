import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from '../components/Icon';
import { styles } from './DashboardScreen.styles';
import type { IntervalKey } from '../types/dashboard';
import { useDashboard } from '../context/DashboardContext';
import { uiPath, uiProps, logUI } from '../lib/devtools';
import { APP_VERSION, fetchLatestVersion, isNewerVersion } from '../lib/version';
import ChangelogModal from '../components/dashboard/ChangelogModal';

export default function QuickNavScreen() {
  const navigation = useNavigation();
  const {
    user,
    signOut,
    accounts,
    primaryAccountId,
    excludedAccountIds,
    accountSettings,
    menuAccountsExpanded,
    setMenuAccountsExpanded,
    menuAccountsEditMode,
    setMenuAccountsEditMode,
    setSelectedAccountId,
    moveAccount,
    setPrimary,
    toggleAccountExclusion,
    openCreateAccount,
    openEditAccount,
    deleteAccount,
    categories,
    selectedCategories,
    hiddenCategoryIds,
    menuIncomeCatExpanded,
    setMenuIncomeCatExpanded,
    menuIncomeCatEditMode,
    setMenuIncomeCatEditMode,
    menuExpenseCatExpanded,
    setMenuExpenseCatExpanded,
    menuExpenseCatEditMode,
    setMenuExpenseCatEditMode,
    toggleCategoryHidden,
    setCategoryName,
    setCategoryType,
    setCategoryColor,
    setCategoryIcon,
    setCategoryTagIds,
    deleteCategory,
    selectedTags,
    menuTagsExpanded,
    setMenuTagsExpanded,
    menuTagsEditMode,
    setMenuTagsEditMode,
    openCreateTag,
    openEditTag,
    deleteTag,
    selectedTagFilter,
    intervalVisibility,
    setIntervalVisibility,
    pendingDebtCount,
    setActiveSection,
    reloadDashboard,
  } = useDashboard();

  const [deletingCategoryIds, setDeletingCategoryIds] = useState<Set<string>>(new Set());
  const [showFinOps, setShowFinOps] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showIntervalVisibility, setShowIntervalVisibility] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const updateAvailable = latestVersion !== null && isNewerVersion(APP_VERSION, latestVersion);

  useEffect(() => {
    void fetchLatestVersion().then(setLatestVersion);
  }, []);

  useEffect(() => {
    logUI(uiPath('quick_nav_screen', 'panel', 'container'), 'mount');
  }, []);

  const handleClose = () => navigation.goBack();

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

  const handleOpenEntry = (type: 'income' | 'expense', categoryId?: string | null) => {
    handleClose();
    (navigation as any).navigate('Entry', { type, categoryId });
  };

  const handleOpenCategory = (categoryId: string | null) => {
    handleClose();
    (navigation as any).navigate('Category', { categoryId });
  };

  return (
    <>
      <View {...uiProps(uiPath('quick_nav_screen', 'panel', 'container'))} style={styles.menuOverlay}>
        <Pressable
          {...uiProps(uiPath('quick_nav_screen', 'panel', 'close_area'))}
          style={styles.menuOverlayTapArea}
          onPress={() => {
            logUI(uiPath('quick_nav_screen', 'panel', 'close_area'), 'press');
            handleClose();
          }}
        />
        <View style={styles.menuPanel}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuScrollContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.menuTitle}>Quick Navigation</Text>
              <TouchableOpacity
                onPress={() => setShowChangelog(true)}
                style={[
                  { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1 },
                  updateAvailable
                    ? { backgroundColor: '#053d1e', borderColor: '#4ade80' }
                    : { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
                ]}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: updateAvailable ? '#4ade80' : '#475569' }}>
                  {updateAvailable ? `v${APP_VERSION} → v${latestVersion!}` : `v${APP_VERSION}`}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Accounts */}
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav_screen', 'accounts', 'section_header'))}
              style={[styles.menuItem, { position: 'relative' }]}
              onPress={() => {
                logUI(uiPath('quick_nav_screen', 'accounts', 'section_header'), 'press');
                setMenuAccountsExpanded((prev) => !prev);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <View style={{ width: 20 }}>
                  <Text style={{ color: '#8FA8C9', fontSize: 11, fontWeight: '700' }}>{menuAccountsExpanded ? '▾' : '▸'}</Text>
                </View>
                <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>Accounts</Text>
                <View style={{ width: menuAccountsExpanded ? 66 : accounts.length === 0 ? 24 : 20 }} />
              </View>
              {(menuAccountsExpanded || accounts.length === 0) && (
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav_screen', 'accounts', 'add_button'))}
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 36, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'accounts', 'add_button'), 'press');
                    handleClose();
                    openCreateAccount();
                  }}
                >
                  <Image source={require('../../assets/new.png')} style={{ height: '100%', aspectRatio: 1 }} resizeMode="contain" />
                </TouchableOpacity>
              )}
              {menuAccountsExpanded && (
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    right: 42,
                    top: 0,
                    bottom: 0,
                    width: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: menuAccountsEditMode ? '#2C4669' : 'transparent',
                  }}
                  onPress={(e) => {
                    e.stopPropagation();
                    logUI(uiPath('quick_nav_screen', 'accounts', 'edit_mode_toggle'), 'press');
                    setMenuAccountsEditMode((p) => !p);
                  }}
                >
                  <Image
                    source={require('../../assets/edit.png')}
                    style={{ height: '100%', aspectRatio: 1 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {menuAccountsExpanded && accounts.map((account, accountIdx) => {
              const isOwned = account.created_by === user?.id;
              const isPrimary = account.id === primaryAccountId;
              return (
                <View
                  {...uiProps(uiPath('quick_nav_screen', 'accounts', 'row', account.id))}
                  key={account.id}
                  style={[styles.manageRow, { position: 'relative' }]}
                >
                  {!menuAccountsEditMode && account.icon && (
                    <Icon name={account.icon as any} size={36} color="#8FA8C9" />
                  )}
                  <TouchableOpacity
                    style={styles.managePrimary}
                    onPress={() => {
                      logUI(uiPath('quick_nav_screen', 'accounts', 'row', account.id), 'press');
                      setSelectedAccountId(account.id);
                      handleClose();
                    }}
                  >
                    <View style={styles.manageNameRow}>
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

                  {/* Primary account indicator */}
                  {!menuAccountsEditMode && isPrimary && (
                    <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, aspectRatio: 1, borderTopRightRadius: 4, borderBottomRightRadius: 4, overflow: 'hidden' }}>
                      <Image
                        source={require('../../assets/primacc.gif')}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    </View>
                  )}

                  {menuAccountsEditMode && (
                    <>
                      <TouchableOpacity
                        style={[styles.manageSmallButton, accountIdx === 0 && styles.manageSmallButtonDisabled]}
                        onPress={() => {
                          logUI(uiPath('quick_nav_screen', 'accounts', 'move_up_button', account.id), 'press');
                          moveAccount(accountIdx, 'up');
                        }}
                        disabled={accountIdx === 0}
                      >
                        <Text style={styles.manageSmallText}>↑</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.manageSmallButton, accountIdx === accounts.length - 1 && styles.manageSmallButtonDisabled]}
                        onPress={() => {
                          logUI(uiPath('quick_nav_screen', 'accounts', 'move_down_button', account.id), 'press');
                          moveAccount(accountIdx, 'down');
                        }}
                        disabled={accountIdx === accounts.length - 1}
                      >
                        <Text style={styles.manageSmallText}>↓</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        {...uiProps(uiPath('quick_nav_screen', 'accounts', 'primary_button', account.id))}
                        style={[styles.manageSmallButton, isPrimary && styles.manageSmallButtonActive]}
                        onPress={() => {
                          logUI(uiPath('quick_nav_screen', 'accounts', 'primary_button', account.id), 'press');
                          setPrimary(account.id);
                        }}
                      >
                        <Text style={[styles.manageSmallText, isPrimary && styles.manageSmallTextActive]}>★</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        {...uiProps(uiPath('quick_nav_screen', 'accounts', 'include_toggle', account.id))}
                        style={[styles.manageIconButton, { backgroundColor: '#000000' }]}
                        onPress={() => {
                          logUI(uiPath('quick_nav_screen', 'accounts', 'include_toggle', account.id), 'press');
                          toggleAccountExclusion(account.id);
                        }}
                      >
                        <Image
                          source={excludedAccountIds.includes(account.id)
                            ? require('../../assets/invisible.png')
                            : require('../../assets/visible.png')}
                          style={{ width: 20, height: 20 }}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>

                      {isOwned ? (
                        <>
                          <TouchableOpacity
                            {...uiProps(uiPath('quick_nav_screen', 'accounts', 'edit_button', account.id))}
                            style={[styles.manageIconButton, { backgroundColor: '#000000' }]}
                            onPress={() => {
                              logUI(uiPath('quick_nav_screen', 'accounts', 'edit_button', account.id), 'press');
                              handleClose();
                              openEditAccount(account);
                            }}
                          >
                            <Image
                              source={require('../../assets/edit.png')}
                              style={{ width: 20, height: 20 }}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            {...uiProps(uiPath('quick_nav_screen', 'accounts', 'delete_button', account.id))}
                            style={[styles.manageIconButton, { backgroundColor: '#000000' }]}
                            onPress={() => {
                              logUI(uiPath('quick_nav_screen', 'accounts', 'delete_button', account.id), 'press');
                              if (Platform.OS === 'web') {
                                if (window.confirm(`Remove ${account.name}? This will delete all transactions, categories, and tags for this account.`)) {
                                  handleClose();
                                  void deleteAccount(account);
                                }
                              } else {
                                Alert.alert('Remove account', `Remove ${account.name}?`, [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Remove',
                                    style: 'destructive',
                                    onPress: () => {
                                      handleClose();
                                      void deleteAccount(account);
                                    },
                                  },
                                ]);
                              }
                            }}
                          >
                            <Image
                              source={require('../../assets/delete.png')}
                              style={{ width: 20, height: 20 }}
                              resizeMode="contain"
                            />
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

            {/* Income Categories */}
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav_screen', 'income_cats', 'section_header'))}
              style={[styles.menuItem, { position: 'relative' }]}
              onPress={() => {
                logUI(uiPath('quick_nav_screen', 'income_cats', 'section_header'), 'press');
                setMenuIncomeCatExpanded((prev) => !prev);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <View style={{ width: 20 }}>
                  <Text style={{ color: '#4ade80', fontSize: 11, fontWeight: '700' }}>{menuIncomeCatExpanded ? '▾' : '▸'}</Text>
                </View>
                <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center', color: '#4ade80' }]}>Income</Text>
                <View style={{ width: menuIncomeCatExpanded ? 66 : !categories.some((c) => c.type === 'income' && c.name !== 'Transfer') ? 24 : 20 }} />
              </View>
              {(menuIncomeCatExpanded || !categories.some((c) => c.type === 'income' && c.name !== 'Transfer')) && (
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav_screen', 'income_cats', 'add_button'))}
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 36, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'income_cats', 'add_button'), 'press');
                    handleOpenCategory(null);
                  }}
                >
                  <Image source={require('../../assets/new.png')} style={{ height: '100%', aspectRatio: 1 }} resizeMode="contain" />
                </TouchableOpacity>
              )}
              {menuIncomeCatExpanded && (
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    right: 42,
                    top: 0,
                    bottom: 0,
                    width: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: menuIncomeCatEditMode ? '#2C4669' : 'transparent',
                  }}
                  onPress={(e) => {
                    e.stopPropagation();
                    logUI(uiPath('quick_nav_screen', 'income_cats', 'edit_mode_toggle'), 'press');
                    setMenuIncomeCatEditMode((p) => !p);
                  }}
                >
                  <Image
                    source={require('../../assets/edit.png')}
                    style={{ height: '100%', aspectRatio: 1 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {menuIncomeCatExpanded && (menuIncomeCatEditMode ? categories : selectedCategories).filter((c) => c.type === 'income' && c.name !== 'Transfer').map((category) => {
              const isHidden = hiddenCategoryIds.has(category.id);
              const catColor = isHidden ? '#475569' : (category.color ?? '#4ade80');
              const isMine = category.user_id === user?.id;
              const isDeleting = deletingCategoryIds.has(category.id);
              return (
                <View
                  {...uiProps(uiPath('quick_nav_screen', 'income_cats', 'row', category.id))}
                  key={category.id}
                  style={[styles.manageRow, isDeleting && { opacity: 0.4 }]}
                  pointerEvents={isDeleting ? 'none' : 'auto'}
                >
                  <TouchableOpacity
                    style={styles.managePrimary}
                    onPress={() => {
                      logUI(uiPath('quick_nav_screen', 'income_cats', 'row', category.id), 'press');
                      handleOpenEntry(category.type, category.id);
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
                        style={[styles.manageIconButton, { backgroundColor: '#000000' }]}
                        onPress={() => {
                          logUI(uiPath('quick_nav_screen', 'income_cats', 'visibility_toggle', category.id), 'press');
                          void toggleCategoryHidden(category.id);
                        }}
                      >
                        <Image
                          source={hiddenCategoryIds.has(category.id)
                            ? require('../../assets/invisible.png')
                            : require('../../assets/visible.png')}
                          style={{ width: 20, height: 20 }}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                      {isMine && (
                        <TouchableOpacity
                          style={[styles.manageIconButton, { backgroundColor: '#000000' }]}
                          onPress={() => {
                            logUI(uiPath('quick_nav_screen', 'income_cats', 'edit_button', category.id), 'press');
                            handleOpenCategory(category.id);
                          }}
                        >
                          <Image
                            source={require('../../assets/edit.png')}
                            style={{ width: 20, height: 20 }}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      )}
                      {isMine && (
                        <TouchableOpacity
                          style={[styles.manageIconButton, { backgroundColor: '#000000' }]}
                          onPress={() => {
                            logUI(uiPath('quick_nav_screen', 'income_cats', 'delete_button', category.id), 'press');
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
                          <Image
                            source={require('../../assets/delete.png')}
                            style={{ width: 20, height: 20 }}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              );
            })}

            {/* Expense Categories */}
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav_screen', 'expense_cats', 'section_header'))}
              style={[styles.menuItem, { position: 'relative' }]}
              onPress={() => {
                logUI(uiPath('quick_nav_screen', 'expense_cats', 'section_header'), 'press');
                setMenuExpenseCatExpanded((prev) => !prev);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <View style={{ width: 20 }}>
                  <Text style={{ color: '#f87171', fontSize: 11, fontWeight: '700' }}>{menuExpenseCatExpanded ? '▾' : '▸'}</Text>
                </View>
                <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center', color: '#f87171' }]}>Expense</Text>
                <View style={{ width: menuExpenseCatExpanded ? 66 : !categories.some((c) => c.type === 'expense' && c.name !== 'Transfer') ? 24 : 20 }} />
              </View>
              {(menuExpenseCatExpanded || !categories.some((c) => c.type === 'expense' && c.name !== 'Transfer')) && (
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav_screen', 'expense_cats', 'add_button'))}
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 36, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'expense_cats', 'add_button'), 'press');
                    handleOpenCategory(null);
                  }}
                >
                  <Image source={require('../../assets/new.png')} style={{ height: '100%', aspectRatio: 1 }} resizeMode="contain" />
                </TouchableOpacity>
              )}
              {menuExpenseCatExpanded && (
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    right: 42,
                    top: 0,
                    bottom: 0,
                    width: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: menuExpenseCatEditMode ? '#2C4669' : 'transparent',
                  }}
                  onPress={(e) => {
                    e.stopPropagation();
                    logUI(uiPath('quick_nav_screen', 'expense_cats', 'edit_mode_toggle'), 'press');
                    setMenuExpenseCatEditMode((p) => !p);
                  }}
                >
                  <Image
                    source={require('../../assets/edit.png')}
                    style={{ height: '100%', aspectRatio: 1 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {menuExpenseCatExpanded && (menuExpenseCatEditMode ? categories : selectedCategories).filter((c) => c.type === 'expense' && c.name !== 'Transfer').map((category) => {
              const isHidden = hiddenCategoryIds.has(category.id);
              const catColor = isHidden ? '#475569' : (category.color ?? '#f87171');
              const isMine = category.user_id === user?.id;
              const isDeleting = deletingCategoryIds.has(category.id);
              return (
                <View
                  {...uiProps(uiPath('quick_nav_screen', 'expense_cats', 'row', category.id))}
                  key={category.id}
                  style={[styles.manageRow, isDeleting && { opacity: 0.4 }]}
                  pointerEvents={isDeleting ? 'none' : 'auto'}
                >
                  <TouchableOpacity
                    style={styles.managePrimary}
                    onPress={() => {
                      logUI(uiPath('quick_nav_screen', 'expense_cats', 'row', category.id), 'press');
                      handleOpenEntry(category.type, category.id);
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
                        style={[styles.manageIconButton, { backgroundColor: '#000000' }]}
                        onPress={() => {
                          logUI(uiPath('quick_nav_screen', 'expense_cats', 'visibility_toggle', category.id), 'press');
                          void toggleCategoryHidden(category.id);
                        }}
                      >
                        <Image
                          source={hiddenCategoryIds.has(category.id)
                            ? require('../../assets/invisible.png')
                            : require('../../assets/visible.png')}
                          style={{ width: 20, height: 20 }}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                      {isMine && (
                        <TouchableOpacity
                          style={[styles.manageIconButton, { backgroundColor: '#000000' }]}
                          onPress={() => {
                            logUI(uiPath('quick_nav_screen', 'expense_cats', 'edit_button', category.id), 'press');
                            handleOpenCategory(category.id);
                          }}
                        >
                          <Image
                            source={require('../../assets/edit.png')}
                            style={{ width: 20, height: 20 }}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      )}
                      {isMine && (
                        <TouchableOpacity
                          style={[styles.manageIconButton, { backgroundColor: '#000000' }]}
                          onPress={() => {
                            logUI(uiPath('quick_nav_screen', 'expense_cats', 'delete_button', category.id), 'press');
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
                          <Image
                            source={require('../../assets/delete.png')}
                            style={{ width: 20, height: 20 }}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              );
            })}

            {/* Transfers - removed for now as onFilterTransfers was removed from context */}

            {/* Tags */}
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav_screen', 'tags', 'section_header'))}
              style={[styles.menuItem, { position: 'relative' }]}
              onPress={() => {
                logUI(uiPath('quick_nav_screen', 'tags', 'section_header'), 'press');
                setMenuTagsExpanded((prev) => !prev);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <View style={{ width: 20 }}>
                  <Text style={{ color: '#8FA8C9', fontSize: 11, fontWeight: '700' }}>{menuTagsExpanded ? '▾' : '▸'}</Text>
                </View>
                <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>Tags</Text>
                <View style={{ width: menuTagsExpanded ? 66 : selectedTags.length === 0 ? 24 : 20 }} />
              </View>
              {(menuTagsExpanded || selectedTags.length === 0) && (
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav_screen', 'tags', 'add_button'))}
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 36, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'tags', 'add_button'), 'press');
                    handleClose();
                    openCreateTag();
                  }}
                >
                  <Image source={require('../../assets/new.png')} style={{ height: '100%', aspectRatio: 1 }} resizeMode="contain" />
                </TouchableOpacity>
              )}
              {menuTagsExpanded && (
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    right: 42,
                    top: 0,
                    bottom: 0,
                    width: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: menuTagsEditMode ? '#2C4669' : 'transparent',
                  }}
                  onPress={(e) => {
                    e.stopPropagation();
                    logUI(uiPath('quick_nav_screen', 'tags', 'edit_mode_toggle'), 'press');
                    setMenuTagsEditMode((p) => !p);
                  }}
                >
                  <Image
                    source={require('../../assets/edit.png')}
                    style={{ height: '100%', aspectRatio: 1 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {menuTagsExpanded && selectedTags.map((tag) => {
              const isActive = selectedTagFilter === tag.id;
              const tagColor = tag.color ?? '#8FA8C9';
              return (
              <View
                {...uiProps(uiPath('quick_nav_screen', 'tags', 'row', tag.id))}
                key={tag.id}
                style={[styles.manageRow, isActive && { backgroundColor: '#0D2137', borderRadius: 6 }]}
              >
                <TouchableOpacity
                  style={styles.managePrimary}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'tags', 'row', tag.id), 'press');
                    handleClose();
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
                      style={[styles.manageIconButton, { backgroundColor: '#000000' }]}
                      onPress={() => {
                        logUI(uiPath('quick_nav_screen', 'tags', 'edit_button', tag.id), 'press');
                        handleClose();
                        openEditTag(tag);
                      }}
                    >
                      <Image
                        source={require('../../assets/edit.png')}
                        style={{ width: 20, height: 20 }}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.manageIconButton, { backgroundColor: '#000000' }]}
                      onPress={() => {
                        logUI(uiPath('quick_nav_screen', 'tags', 'delete_button', tag.id), 'press');
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
                      <Image
                        source={require('../../assets/delete.png')}
                        style={{ width: 20, height: 20 }}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </>
                )}
              </View>
              );
            })}

            {/* FinBiome */}
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav_screen', 'nav', 'finbiome_item'))}
              style={styles.menuItem}
              onPress={() => {
                logUI(uiPath('quick_nav_screen', 'nav', 'finbiome_item'), 'press');
                handleClose();
                (navigation as any).navigate('FinBiome');
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <View style={{ width: 20 }}>
                  <Icon name="TreeDeciduous" size={14} color="#00F5D4" />
                </View>
                <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center', color: '#00F5D4' }]}>FinBiome</Text>
                <View style={{ minWidth: 20 }} />
              </View>
            </TouchableOpacity>

            {/* FinOps */}
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav_screen', 'nav', 'finops_toggle'))}
              style={styles.menuItem}
              onPress={() => {
                logUI(uiPath('quick_nav_screen', 'nav', 'finops_toggle'), 'press');
                setShowFinOps((p) => !p);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <View style={{ width: 20 }}>
                  <Text style={{ color: '#53E3A6', fontSize: 11, fontWeight: '700' }}>{showFinOps ? '▾' : '▸'}</Text>
                </View>
                <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>FinOps</Text>
                <View style={{ minWidth: 20, alignItems: 'flex-end' }}>
                  {pendingDebtCount > 0 && !showFinOps && (
                    <View style={{ backgroundColor: '#f87171', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{pendingDebtCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
            {showFinOps && (
              <>
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav_screen', 'nav', 'pools_item'))}
                  style={[styles.menuItem, { paddingLeft: 20 }]}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'nav', 'pools_item'), 'press');
                    handleClose();
                    setActiveSection('pools');
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <View style={{ width: 22 }}>
                      <Icon name="Users" size={14} color="#8FA8C9" />
                    </View>
                    <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>Pools</Text>
                    <View style={{ minWidth: 22 }} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav_screen', 'nav', 'lending_item'))}
                  style={[styles.menuItem, { paddingLeft: 20 }]}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'nav', 'lending_item'), 'press');
                    handleClose();
                    setActiveSection('lending');
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <View style={{ width: 22 }}>
                      <Icon name="Banknote" size={14} color="#8FA8C9" />
                    </View>
                    <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>Lending</Text>
                    <View style={{ minWidth: 22, alignItems: 'flex-end' }}>
                      {pendingDebtCount > 0 && (
                        <View style={{ backgroundColor: '#f87171', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{pendingDebtCount}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav_screen', 'nav', 'settlements_item'))}
                  style={[styles.menuItem, { paddingLeft: 20 }]}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'nav', 'settlements_item'), 'press');
                    handleClose();
                    setActiveSection('settlements');
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <View style={{ width: 22 }}>
                      <Icon name="ArrowRightLeft" size={14} color="#8FA8C9" />
                    </View>
                    <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>Settlements</Text>
                    <View style={{ minWidth: 22 }} />
                  </View>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav_screen', 'nav', 'friends_item'))}
              style={styles.menuItem}
              onPress={() => {
                logUI(uiPath('quick_nav_screen', 'nav', 'friends_item'), 'press');
                handleClose();
                (navigation as any).navigate('Friends');
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <View style={{ width: 20 }} />
                <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>Friends</Text>
                <View style={{ minWidth: 20 }} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav_screen', 'nav', 'contacts_item'))}
              style={styles.menuItem}
              onPress={() => {
                logUI(uiPath('quick_nav_screen', 'nav', 'contacts_item'), 'press');
                handleClose();
                setActiveSection('contacts');
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <View style={{ width: 20 }} />
                <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>Contacts</Text>
                <View style={{ minWidth: 20 }} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              {...uiProps(uiPath('quick_nav_screen', 'nav', 'experimental_toggle'))}
              style={styles.menuItem}
              onPress={() => {
                logUI(uiPath('quick_nav_screen', 'nav', 'experimental_toggle'), 'press');
                setShowSettings((p) => !p);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <View style={{ width: 20 }}>
                  <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700' }}>{showSettings ? '▾' : '▸'}</Text>
                </View>
                <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>Settings</Text>
                <View style={{ minWidth: 20 }} />
              </View>
            </TouchableOpacity>
            {showSettings && (
              <>
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav_screen', 'nav', 'invitations_item'))}
                  style={[styles.menuItem, { paddingLeft: 20 }]}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'nav', 'invitations_item'), 'press');
                    handleClose();
                    (navigation as any).navigate('Invitations');
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <View style={{ width: 20 }} />
                    <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>Invitations</Text>
                    <View style={{ minWidth: 20 }} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav_screen', 'nav', 'changelog_item'))}
                  style={[styles.menuItem, { paddingLeft: 20 }]}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'nav', 'changelog_item'), 'press');
                    setShowChangelog(true);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <View style={{ width: 20 }} />
                    <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>Changelogs</Text>
                    <View style={{ minWidth: 20 }} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav_screen', 'interval_visibility', 'toggle'))}
                  style={[styles.menuItem, { paddingLeft: 20 }]}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'interval_visibility', 'toggle'), 'press');
                    setShowIntervalVisibility((p) => !p);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <View style={{ width: 20 }}>
                      <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700' }}>{showIntervalVisibility ? '▾' : '▸'}</Text>
                    </View>
                    <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>Visible Intervals</Text>
                    <View style={{ minWidth: 20 }} />
                  </View>
                </TouchableOpacity>
                {showIntervalVisibility && (['day', 'week', 'month', 'year', 'all', 'custom'] as IntervalKey[]).map((key) => (
                  <TouchableOpacity
                    {...uiProps(uiPath('quick_nav_screen', 'interval_visibility', 'key', key))}
                    key={key}
                    style={[styles.menuItem, { paddingVertical: 6, paddingLeft: 36 }]}
                    onPress={() => {
                      logUI(uiPath('quick_nav_screen', 'interval_visibility', 'key', key), 'press');
                      setIntervalVisibility({ ...intervalVisibility, [key]: !intervalVisibility[key] });
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                      <View style={{ width: 20 }} />
                      <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>{key.toUpperCase()}</Text>
                      <View style={{ minWidth: 20, alignItems: 'flex-end' }}>
                        <Text style={{ color: intervalVisibility[key] ? '#4ade80' : '#64748B', fontSize: 13, fontWeight: '700' }}>
                          {intervalVisibility[key] ? '✓' : '✕'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav_screen', 'nav', 'reload_button'))}
                  style={[styles.menuItem, { paddingLeft: 20 }]}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'nav', 'reload_button'), 'press');
                    handleClose();
                    if (Platform.OS === 'web') {
                      const doReload = () => {
                        window.location.replace(
                          window.location.origin + window.location.pathname
                        );
                      };
                      const steps: Promise<unknown>[] = [];
                      if ('serviceWorker' in navigator) {
                        steps.push(
                          navigator.serviceWorker.getRegistrations().then((regs) =>
                            Promise.all(regs.map((r) => r.unregister()))
                          )
                        );
                      }
                      if ('caches' in window) {
                        steps.push(
                          caches.keys().then((names) =>
                            Promise.all(names.map((n) => caches.delete(n)))
                          )
                        );
                      }
                      void Promise.all(steps).then(doReload);
                    } else {
                      void reloadDashboard();
                    }
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <View style={{ width: 20 }} />
                    <Text style={[styles.menuItemText, { flex: 1, textAlign: 'center' }]}>Reload app</Text>
                    <View style={{ minWidth: 20 }} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  {...uiProps(uiPath('quick_nav_screen', 'nav', 'signout_button'))}
                  style={[styles.menuDanger, { marginTop: 4 }]}
                  onPress={() => {
                    logUI(uiPath('quick_nav_screen', 'nav', 'signout_button'), 'press');
                    signOut();
                  }}
                >
                  <Text style={styles.menuDangerText}>Sign out</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
      <ChangelogModal visible={showChangelog} onClose={() => setShowChangelog(false)} />
    </>
  );
}
