import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useFinven } from '../hooks/useFinven';
import DashboardHeader from '../components/dashboard/layout/DashboardHeader';
import LocationDetailSheet from '../components/finven/LocationDetailSheet';
import ProductFormModal from '../components/finven/ProductFormModal';
import TransactionBreakdownSheet from '../components/finven/TransactionBreakdownSheet';
import FindashTransactionPicker from '../components/shared/FindashTransactionPicker';
import { logUI, uiPath, uiProps } from '../lib/devtools';
import { bottomInset } from '../lib/safeArea';
import type { FinvenLocation, FinvenProduct } from '../types/finven';
import type { AppTransaction } from '../types/dashboard';

type Tab = 'inventory' | 'products' | 'shopping';

export default function FinVenScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const user = session?.user ?? null;
  const { bottom } = useSafeAreaInsets();

  const {
    locations, products, stockItems, shoppingList, loading,
    createLocation, updateLocation, deleteLocation,
    createProduct, updateProduct, deleteProduct,
    saveTransactionBreakdown,
    addShoppingItem, checkShoppingItem, deleteShoppingItem,
    autoPopulateShoppingList,
  } = useFinven(user);

  const [activeTab, setActiveTab] = useState<Tab>('inventory');
  const [selectedLocation, setSelectedLocation] = useState<FinvenLocation | null>(null);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationIcon, setNewLocationIcon] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);

  const [editingProduct, setEditingProduct] = useState<FinvenProduct | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);

  const [showTxPicker, setShowTxPicker] = useState(false);
  const [showBreakdownSheet, setShowBreakdownSheet] = useState(false);
  const [pickedTx, setPickedTx] = useState<AppTransaction | null>(null);

  const [showAddShoppingModal, setShowAddShoppingModal] = useState(false);
  const [shoppingName, setShoppingName] = useState('');
  const [shoppingProductId, setShoppingProductId] = useState<string | null>(null);
  const [shoppingQty, setShoppingQty] = useState('');
  const [shoppingUnit, setShoppingUnit] = useState('');
  const [shoppingProductSearch, setShoppingProductSearch] = useState('');
  const [shoppingSaving, setShoppingSaving] = useState(false);

  // Auto-populate low-stock items on shopping tab focus
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'shopping') {
        void autoPopulateShoppingList();
      }
    }, [activeTab, autoPopulateShoppingList]),
  );

  useEffect(() => {
    if (activeTab === 'shopping') {
      void autoPopulateShoppingList();
    }
  }, [activeTab, autoPopulateShoppingList]);

  const handleSaveLocation = async () => {
    if (!newLocationName.trim()) return;
    setLocationSaving(true);
    const ok = await createLocation(newLocationName.trim(), newLocationIcon.trim() || null);
    setLocationSaving(false);
    if (ok) {
      setShowAddLocationModal(false);
      setNewLocationName('');
      setNewLocationIcon('');
    }
  };

  const handleOpenLocation = (loc: FinvenLocation) => {
    setSelectedLocation(loc);
    setShowLocationSheet(true);
  };

  const handlePickTx = (tx: AppTransaction) => {
    setPickedTx(tx);
    setShowTxPicker(false);
    setShowBreakdownSheet(true);
  };

  const handleSaveBreakdown = async (items: Parameters<typeof saveTransactionBreakdown>[1]) => {
    if (!pickedTx) return false;
    const ok = await saveTransactionBreakdown(pickedTx.id, items);
    if (ok) setPickedTx(null);
    return ok;
  };

  const handleSaveShoppingItem = async () => {
    if (!shoppingName.trim()) return;
    setShoppingSaving(true);
    await addShoppingItem(
      shoppingName.trim(),
      shoppingProductId,
      shoppingQty ? parseFloat(shoppingQty) : null,
      shoppingUnit.trim() || null,
      'manual',
    );
    setShoppingSaving(false);
    setShowAddShoppingModal(false);
    setShoppingName('');
    setShoppingProductId(null);
    setShoppingQty('');
    setShoppingUnit('');
    setShoppingProductSearch('');
  };

  const today = new Date();
  const threeDays = new Date(today);
  threeDays.setDate(today.getDate() + 3);

  const getExpiryColor = (expiryDate: string | null): string => {
    if (!expiryDate) return '#CBD5E1';
    const d = new Date(expiryDate);
    if (d < today) return '#f87171';
    if (d <= threeDays) return '#FBBF24';
    return '#CBD5E1';
  };

  const uncheckedCount = shoppingList.filter((s) => !s.checked).length;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'inventory', label: 'Inventory' },
    { key: 'products', label: 'Products' },
    { key: 'shopping', label: `Shopping${uncheckedCount > 0 ? ` (${uncheckedCount})` : ''}` },
  ];

  const filteredShoppingProducts = products.filter((p) =>
    shoppingProductSearch.trim()
      ? p.name.toLowerCase().includes(shoppingProductSearch.toLowerCase())
      : true,
  ).slice(0, 10);

  const rightElement = activeTab === 'inventory' ? (
    <TouchableOpacity
      {...uiProps(uiPath('finven', 'header', 'add_location_button'))}
      style={styles.addButton}
      onPress={() => {
        logUI(uiPath('finven', 'header', 'add_location_button'), 'press');
        setShowAddLocationModal(true);
      }}
    >
      <Text style={styles.addButtonText}>＋</Text>
    </TouchableOpacity>
  ) : activeTab === 'products' ? (
    <TouchableOpacity
      {...uiProps(uiPath('finven', 'header', 'add_product_button'))}
      style={styles.addButton}
      onPress={() => {
        logUI(uiPath('finven', 'header', 'add_product_button'), 'press');
        setEditingProduct(null);
        setShowProductModal(true);
      }}
    >
      <Text style={styles.addButtonText}>＋</Text>
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      {...uiProps(uiPath('finven', 'header', 'add_shopping_button'))}
      style={styles.addButton}
      onPress={() => {
        logUI(uiPath('finven', 'header', 'add_shopping_button'), 'press');
        setShowAddShoppingModal(true);
      }}
    >
      <Text style={styles.addButtonText}>＋</Text>
    </TouchableOpacity>
  );

  return (
    <View {...uiProps(uiPath('finven', 'screen', 'container'))} style={styles.screen}>
      <DashboardHeader
        onBack={() => {
          logUI(uiPath('finven', 'header', 'back_button'), 'press');
          navigation.goBack();
        }}
        rightElement={rightElement}
      />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            {...uiProps(uiPath('finven', 'tab_bar', tab.key))}
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => {
              logUI(uiPath('finven', 'tab_bar', tab.key), 'press');
              setActiveTab(tab.key);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        {...uiProps(uiPath('finven', 'screen', 'scroll_view'))}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset(16, bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Inventory ── */}
        {activeTab === 'inventory' && (
          <>
            {loading && locations.length === 0 ? (
              <Text style={styles.loadingText}>Loading…</Text>
            ) : locations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No locations yet</Text>
                <Text style={styles.emptyHint}>Tap ＋ to add a storage location like Fridge or Pantry.</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={() => setShowAddLocationModal(true)}>
                  <Text style={styles.emptyButtonText}>Add Location</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Items without location */}
                {stockItems.filter((s) => !s.location_id).length > 0 && (
                  <View style={styles.locationGroup}>
                    <Text style={styles.locationGroupTitle}>Unassigned</Text>
                    {stockItems.filter((s) => !s.location_id).map((item) => {
                      const product = products.find((p) => p.id === item.product_id);
                      const expiryColor = getExpiryColor(item.expiry_date ?? null);
                      return (
                        <View key={item.id} style={styles.stockRow}>
                          <View style={styles.stockRowLeft}>
                            <Text style={styles.stockRowName}>{product?.name ?? 'Unknown'}</Text>
                            <Text style={styles.stockRowMeta}>{item.quantity} {item.unit}</Text>
                          </View>
                          {item.expiry_date && (
                            <Text style={[styles.expiryText, { color: expiryColor }]}>{item.expiry_date}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {locations.map((loc) => {
                  const locItems = stockItems.filter((s) => s.location_id === loc.id);
                  return (
                    <TouchableOpacity
                      {...uiProps(uiPath('finven', 'inventory', 'location_group', loc.id))}
                      key={loc.id}
                      style={styles.locationGroup}
                      onPress={() => {
                        logUI(uiPath('finven', 'inventory', 'location_group', loc.id), 'press');
                        handleOpenLocation(loc);
                      }}
                    >
                      <View style={styles.locationGroupHeader}>
                        <Text style={styles.locationGroupTitle}>{loc.name}</Text>
                        <Text style={styles.locationGroupCount}>{locItems.length} items ›</Text>
                      </View>
                      {locItems.slice(0, 5).map((item) => {
                        const product = products.find((p) => p.id === item.product_id);
                        const expiryColor = getExpiryColor(item.expiry_date ?? null);
                        return (
                          <View key={item.id} style={styles.stockRow}>
                            <View style={styles.stockRowLeft}>
                              <Text style={styles.stockRowName}>{product?.name ?? 'Unknown'}</Text>
                              <Text style={styles.stockRowMeta}>{item.quantity} {item.unit}</Text>
                            </View>
                            {item.expiry_date && (
                              <Text style={[styles.expiryText, { color: expiryColor }]}>{item.expiry_date}</Text>
                            )}
                          </View>
                        );
                      })}
                      {locItems.length > 5 && (
                        <Text style={styles.moreText}>+{locItems.length - 5} more…</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ── Products ── */}
        {activeTab === 'products' && (
          <>
            {loading && products.length === 0 ? (
              <Text style={styles.loadingText}>Loading…</Text>
            ) : products.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No products yet</Text>
                <Text style={styles.emptyHint}>Tap ＋ to add products to your catalogue.</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={() => { setEditingProduct(null); setShowProductModal(true); }}>
                  <Text style={styles.emptyButtonText}>Add Product</Text>
                </TouchableOpacity>
              </View>
            ) : (
              products.map((product) => (
                <TouchableOpacity
                  {...uiProps(uiPath('finven', 'products', 'row', product.id))}
                  key={product.id}
                  style={styles.productRow}
                  onPress={() => {
                    logUI(uiPath('finven', 'products', 'row', product.id), 'press');
                    setEditingProduct(product);
                    setShowProductModal(true);
                  }}
                >
                  <View style={styles.productRowLeft}>
                    <Text style={styles.productRowName}>{product.name}</Text>
                    <Text style={styles.productRowMeta}>
                      {product.default_unit}{product.category_hint ? ` · ${product.category_hint}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.editHint}>✎</Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* ── Shopping ── */}
        {activeTab === 'shopping' && (
          <>
            <TouchableOpacity
              {...uiProps(uiPath('finven', 'shopping', 'breakdown_button'))}
              style={styles.breakdownBtn}
              onPress={() => {
                logUI(uiPath('finven', 'shopping', 'breakdown_button'), 'press');
                setShowTxPicker(true);
              }}
            >
              <Text style={styles.breakdownBtnText}>📦 Break down a transaction</Text>
            </TouchableOpacity>

            {shoppingList.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Shopping list is empty</Text>
                <Text style={styles.emptyHint}>Tap ＋ to add items, or low-stock products appear here automatically.</Text>
              </View>
            ) : (
              shoppingList.map((item) => (
                <View
                  {...uiProps(uiPath('finven', 'shopping', 'row', item.id))}
                  key={item.id}
                  style={[styles.shoppingRow, item.checked && styles.shoppingRowChecked]}
                >
                  <TouchableOpacity
                    style={styles.shoppingCheckbox}
                    onPress={() => void checkShoppingItem(item.id, !item.checked)}
                  >
                    <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                      {item.checked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <View style={styles.shoppingRowInfo}>
                    <Text style={[styles.shoppingRowName, item.checked && styles.shoppingRowNameChecked]}>
                      {item.name}
                    </Text>
                    <Text style={styles.shoppingRowMeta}>
                      {item.quantity ? `${item.quantity} ${item.unit ?? ''}` : ''}
                      {item.added_reason !== 'manual' ? ` · ${item.added_reason.replace('_', ' ')}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.shoppingDeleteBtn}
                    onPress={() => void deleteShoppingItem(item.id)}
                  >
                    <Text style={styles.shoppingDeleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Add location modal */}
      <Modal visible={showAddLocationModal} transparent animationType="slide" onRequestClose={() => setShowAddLocationModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Location</Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput style={styles.input} value={newLocationName} onChangeText={setNewLocationName} placeholder="e.g. Fridge, Pantry" placeholderTextColor="#475569" />
            <Text style={styles.fieldLabel}>Icon name (optional)</Text>
            <TextInput style={styles.input} value={newLocationIcon} onChangeText={setNewLocationIcon} placeholder="e.g. Refrigerator" placeholderTextColor="#475569" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddLocationModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, (!newLocationName.trim() || locationSaving) && styles.submitDisabled]}
                onPress={() => void handleSaveLocation()}
                disabled={!newLocationName.trim() || locationSaving}
              >
                <Text style={styles.submitText}>{locationSaving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add shopping item modal */}
      <Modal visible={showAddShoppingModal} transparent animationType="slide" onRequestClose={() => setShowAddShoppingModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add Shopping Item</Text>
            <Text style={styles.fieldLabel}>Product (optional)</Text>
            <TextInput
              style={styles.input}
              value={shoppingProductSearch}
              onChangeText={setShoppingProductSearch}
              placeholder="Search products…"
              placeholderTextColor="#475569"
            />
            {shoppingProductSearch.trim() && filteredShoppingProducts.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.productDropdownRow}
                onPress={() => {
                  setShoppingProductId(p.id);
                  setShoppingName(p.name);
                  setShoppingUnit(p.default_unit);
                  setShoppingProductSearch('');
                }}
              >
                <Text style={styles.productDropdownName}>{p.name}</Text>
              </TouchableOpacity>
            ))}
            {shoppingProductId && (
              <View style={styles.selectedProductChip}>
                <Text style={styles.selectedProductText}>
                  {products.find((p) => p.id === shoppingProductId)?.name ?? shoppingProductId}
                </Text>
                <TouchableOpacity onPress={() => { setShoppingProductId(null); }}>
                  <Text style={{ color: '#475569', marginLeft: 6 }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput style={styles.input} value={shoppingName} onChangeText={setShoppingName} placeholder="Item name" placeholderTextColor="#475569" />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Qty (optional)</Text>
                <TextInput style={styles.input} value={shoppingQty} onChangeText={setShoppingQty} keyboardType="decimal-pad" placeholder="1" placeholderTextColor="#475569" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Unit (optional)</Text>
                <TextInput style={styles.input} value={shoppingUnit} onChangeText={setShoppingUnit} placeholder="piece" placeholderTextColor="#475569" />
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddShoppingModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, (!shoppingName.trim() || shoppingSaving) && styles.submitDisabled]}
                onPress={() => void handleSaveShoppingItem()}
                disabled={!shoppingName.trim() || shoppingSaving}
              >
                <Text style={styles.submitText}>{shoppingSaving ? 'Adding…' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <LocationDetailSheet
        visible={showLocationSheet}
        location={selectedLocation}
        stockItems={stockItems}
        products={products}
        onClose={() => setShowLocationSheet(false)}
        onUpdate={(patch) => selectedLocation ? updateLocation(selectedLocation.id, patch) : Promise.resolve(false)}
        onDelete={() => selectedLocation ? deleteLocation(selectedLocation.id) : Promise.resolve(false)}
      />

      <ProductFormModal
        visible={showProductModal}
        editingProduct={editingProduct}
        onClose={() => setShowProductModal(false)}
        onSave={(name, defaultUnit, categoryHint, barcode) =>
          editingProduct
            ? updateProduct(editingProduct.id, { name, default_unit: defaultUnit, category_hint: categoryHint, barcode })
            : createProduct(name, defaultUnit, categoryHint, barcode).then((p) => !!p)
        }
      />

      <FindashTransactionPicker
        visible={showTxPicker}
        onClose={() => setShowTxPicker(false)}
        onSelect={handlePickTx}
      />

      <TransactionBreakdownSheet
        visible={showBreakdownSheet}
        transaction={pickedTx}
        products={products}
        locations={locations}
        onClose={() => setShowBreakdownSheet(false)}
        onSave={handleSaveBreakdown}
        onCreateProduct={(name, unit) => createProduct(name, unit, null, null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060D18' },
  addButton: { width: 32, alignItems: 'flex-end' },
  addButtonText: { color: '#60A5FA', fontSize: 22, fontWeight: '400', lineHeight: 24 },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#1F3A59',
    gap: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
    alignItems: 'center',
  },
  tabItemActive: { borderColor: '#60A5FA', backgroundColor: '#071a2e' },
  tabText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#60A5FA' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  loadingText: { color: '#475569', textAlign: 'center', marginTop: 40 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { color: '#CBD5E1', fontSize: 18, fontWeight: '700' },
  emptyHint: { color: '#475569', fontSize: 13, textAlign: 'center', maxWidth: 280 },
  emptyButton: {
    marginTop: 10,
    backgroundColor: '#071a2e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#60A5FA',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  emptyButtonText: { color: '#60A5FA', fontWeight: '700' },
  // Inventory tab
  locationGroup: {
    backgroundColor: '#0B1728',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 12,
    marginBottom: 10,
  },
  locationGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  locationGroupTitle: { color: '#CBD5E1', fontSize: 14, fontWeight: '700' },
  locationGroupCount: { color: '#475569', fontSize: 12 },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
    gap: 8,
  },
  stockRowLeft: { flex: 1 },
  stockRowName: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  stockRowMeta: { color: '#475569', fontSize: 11, marginTop: 1 },
  expiryText: { fontSize: 11, fontWeight: '600' },
  moreText: { color: '#475569', fontSize: 11, marginTop: 6, textAlign: 'right' },
  // Products tab
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1728',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 14,
    marginBottom: 8,
  },
  productRowLeft: { flex: 1 },
  productRowName: { color: '#CBD5E1', fontSize: 14, fontWeight: '700' },
  productRowMeta: { color: '#475569', fontSize: 12, marginTop: 2 },
  editHint: { color: '#475569', fontSize: 14 },
  // Shopping tab
  breakdownBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#60A5FA',
    backgroundColor: '#071a2e',
    alignItems: 'center',
    marginBottom: 14,
  },
  breakdownBtnText: { color: '#60A5FA', fontWeight: '700', fontSize: 13 },
  shoppingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1728',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  shoppingRowChecked: { opacity: 0.5 },
  shoppingCheckbox: { padding: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#60A5FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#60A5FA', borderColor: '#60A5FA' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  shoppingRowInfo: { flex: 1 },
  shoppingRowName: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  shoppingRowNameChecked: { textDecorationLine: 'line-through', color: '#475569' },
  shoppingRowMeta: { color: '#475569', fontSize: 11, marginTop: 2 },
  shoppingDeleteBtn: { padding: 4 },
  shoppingDeleteText: { color: '#f87171', fontSize: 14 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
  },
  modalTitle: { color: '#CBD5E1', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  fieldLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 5,
  },
  row2: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    color: '#CBD5E1',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#1F3A59', alignItems: 'center',
  },
  cancelText: { color: '#64748B', fontWeight: '600' },
  submitButton: {
    flex: 2, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#071a2e', borderWidth: 1, borderColor: '#60A5FA', alignItems: 'center',
  },
  submitDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  submitText: { color: '#60A5FA', fontWeight: '700' },
  productDropdownRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
  },
  productDropdownName: { color: '#CBD5E1', fontSize: 13 },
  selectedProductChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#071a2e',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#60A5FA',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  selectedProductText: { color: '#60A5FA', fontSize: 12 },
});
