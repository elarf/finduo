import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, TextInput, Platform, Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAssets } from '../hooks/useAssets';
import { useAssetParts } from '../hooks/useAssetParts';
import { useUsageLogs } from '../hooks/useUsageLogs';
import { useAssetTransactions } from '../hooks/useAssetTransactions';
import { useComponents } from '../hooks/useComponents';
import { useServiceIntervals } from '../hooks/useServiceIntervals';
import { useServiceRecords } from '../hooks/useServiceRecords';
import ServiceDashboard from '../components/fingo/ServiceDashboard';
import AssetAccordion from '../components/fingo/AssetAccordion';
import GoButton from '../components/fingo/GoButton';
import DashboardHeader from '../components/dashboard/layout/DashboardHeader';
import ComponentLibrarySheet from '../components/fingo/ComponentLibrarySheet';
import ComponentFormSheet from '../components/fingo/ComponentFormSheet';
import ServiceIntervalSheet from '../components/fingo/ServiceIntervalSheet';
import ServiceRecordSheet from '../components/fingo/ServiceRecordSheet';
import type { ComponentActionType } from '../components/fingo/ComponentActionSheet';
import type {
  FinGoAsset, AssetPart, AssetType, FinGoSortOrder,
  Component, ComponentServiceInterval, ComponentTemplate, ComponentServiceRecord,
} from '../types/fingo';

type IntervalWithComponent = { interval: ComponentServiceInterval; component: Component };import type { AppCategory } from '../types/dashboard';
import { supabase } from '../lib/supabase';
import { uiPath, uiProps, logUI } from '../lib/devtools';
import { getTrackingValue } from '../lib/fingo/health';
import { setupFinGoChannels } from '../lib/fingo/notifications';
import { registerBackHandler } from '../lib/capacitorBack';
import { bottomInset } from '../lib/safeArea';
import { useHCAutoSync } from '../hooks/useHCAutoSync';

const ASSET_TYPES: AssetType[] = ['vehicle', 'motorbike', 'bike', 'shoe', 'other'];

export default function FinGoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const user = session?.user ?? null;
  const { bottom } = useSafeAreaInsets();

  // ─── Existing hooks ──────────────────────────────────────────────────────────
  const { assets, loading, loadAssets, createAsset, updateAsset, setActiveAsset, deleteAsset } = useAssets(user);
  const { parts, loadParts, servicePart } = useAssetParts();
  const { logs, loadLogs, addUsageLog, updateLog } = useUsageLogs(user);
  const { categoryLinks, transactions, loadAssetStats, linkCategory, unlinkCategory } = useAssetTransactions();

  // ─── New component hooks ──────────────────────────────────────────────────────
  const {
    componentsByAsset, storageComponents, getTree, getAllComponents,
    loadComponents, loadStorageComponents,
    createComponent, updateComponent,
    installComponent, uninstallComponent,
    retireComponent, deleteComponent, moveComponent, replaceComponent,
  } = useComponents(user);
  const { intervals, loadIntervals, createInterval, updateInterval, markServiced, deleteInterval } = useServiceIntervals();
  const { records: allServiceRecords, loadRecords, createRecord } = useServiceRecords(user);

  useHCAutoSync();

  // ─── UI state ─────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [sortOrder, setSortOrder] = useState<FinGoSortOrder>('deadline');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [focusedAssetId, setFocusedAssetId] = useState<string | null>(null);
  const [recordsByAsset, setRecordsByAsset] = useState<Record<string, ComponentServiceRecord[]>>({});

  const scrollViewRef = useRef<ScrollView>(null);
  const accordionOffsets = useRef<Record<string, number>>({});

  const focusedAsset = useMemo(
    () => (focusedAssetId ? (assets.find((a) => a.id === focusedAssetId) ?? null) : null),
    [assets, focusedAssetId],
  );

  const collapseAccordion = useCallback(() => {
    setFocusedAssetId(null);
    setTimeout(() => scrollViewRef.current?.scrollTo({ y: 0, animated: true }), 50);
  }, []);

  // Asset create/edit modal
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FinGoAsset | null>(null);
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('vehicle');
  const [assetIsActive, setAssetIsActive] = useState(false);
  const [assetSaving, setAssetSaving] = useState(false);

  // Component sheet state
  const [showLibrary, setShowLibrary] = useState(false);
  const [showComponentForm, setShowComponentForm] = useState(false);
  const [showIntervalSheet, setShowIntervalSheet] = useState(false);
  const [showRecordSheet, setShowRecordSheet] = useState(false);

  useEffect(() => { setupFinGoChannels(); }, []);

  // Android back button: close internal modals before navigating away
  const fingoModalRef = useRef({ showAssetModal: false, showLibrary: false, showComponentForm: false, showIntervalSheet: false, showRecordSheet: false });
  useEffect(() => {
    fingoModalRef.current = { showAssetModal, showLibrary, showComponentForm, showIntervalSheet, showRecordSheet };
  });
  useEffect(() => registerBackHandler(() => {
    const m = fingoModalRef.current;
    if (m.showRecordSheet) { setShowRecordSheet(false); return true; }
    if (m.showIntervalSheet) { setShowIntervalSheet(false); return true; }
    if (m.showComponentForm) { setShowComponentForm(false); return true; }
    if (m.showLibrary) { setShowLibrary(false); return true; }
    if (m.showAssetModal) { setShowAssetModal(false); return true; }
    if (focusedAssetId) { setFocusedAssetId(null); return true; }
    return false;
  }), [focusedAssetId]);

  // Pending context for sheets
  const [pendingAsset, setPendingAsset] = useState<FinGoAsset | null>(null);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<ComponentTemplate | null>(null);
  const [pendingCustomName, setPendingCustomName] = useState('');
  const [activeComponent, setActiveComponent] = useState<Component | null>(null);
  const [editingInterval, setEditingInterval] = useState<ComponentServiceInterval | null>(null);
  const [libraryForReplace, setLibraryForReplace] = useState(false);
  const [pendingAllIntervals, setPendingAllIntervals] = useState<IntervalWithComponent[]>([]);

  // ─── Load data on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    void loadAssets();
    void loadCategories();
  }, [loadAssets]);

  useFocusEffect(
    useCallback(() => {
      void loadAssets();
      void loadCategories();
    }, [loadAssets]),
  );

  useEffect(() => {
    for (const asset of assets) {
      void loadParts(asset.id);
      void loadAssetStats(asset.id);
      void loadComponents(asset.id);
      void loadLogs(asset.id);
      void (async () => {
        try {
          const { data } = await supabase
            .from('component_service_records')
            .select('*')
            .eq('asset_id', asset.id)
            .order('serviced_at', { ascending: false });
          setRecordsByAsset((prev) => ({ ...prev, [asset.id]: (data ?? []) as ComponentServiceRecord[] }));
        } catch (err) {
          // silently fail, service records are optional
        }
      })();
    }
  }, [assets, loadParts, loadAssetStats, loadComponents, loadLogs]);

  // Load intervals for all components as they come in
  const componentIdStr = useMemo(
    () => Object.values(componentsByAsset).flat().map((c) => c.id).join(','),
    [componentsByAsset],
  );
  useEffect(() => {
    for (const id of componentIdStr.split(',').filter(Boolean)) {
      void loadIntervals(id);
    }
  }, [componentIdStr, loadIntervals]);

  useFocusEffect(
    useCallback(() => {
      for (const id of componentIdStr.split(',').filter(Boolean)) {
        void loadIntervals(id);
      }
    }, [componentIdStr, loadIntervals]),
  );

  const loadCategories = async () => {
    const { data } = await supabase.from('categories').select('*');
    setCategories((data ?? []) as AppCategory[]);
  };

  // ─── Asset CRUD ───────────────────────────────────────────────────────────────
  const openCreateAsset = useCallback(() => {
    setEditingAsset(null);
    setAssetName('');
    setAssetType('vehicle');
    setAssetIsActive(false);
    setShowAssetModal(true);
  }, []);

  const openEditAsset = useCallback((asset: FinGoAsset) => {
    setEditingAsset(asset);
    setAssetName(asset.name);
    setAssetType(asset.type);
    setAssetIsActive(asset.is_active ?? false);
    setShowAssetModal(true);
  }, []);

  const handleSaveAsset = async () => {
    if (!assetName.trim()) return;
    setAssetSaving(true);
    try {
      if (editingAsset) {
        await updateAsset(editingAsset.id, { name: assetName.trim(), type: assetType });
        if (assetIsActive && !editingAsset.is_active) {
          await setActiveAsset(editingAsset.id, assetType);
        } else if (!assetIsActive && editingAsset.is_active) {
          await updateAsset(editingAsset.id, { is_active: false });
        }
      } else {
        const created = await createAsset(assetName.trim(), assetType);
        if (assetIsActive && created) {
          await setActiveAsset(created.id, assetType);
        }
      }
      setShowAssetModal(false);
    } finally {
      setAssetSaving(false);
    }
  };

  const handleDeleteAsset = useCallback(async (assetId: string) => {
    await deleteAsset(assetId);
    if (selectedAssetId === assetId) setSelectedAssetId(null);
    if (focusedAssetId === assetId) setFocusedAssetId(null);
  }, [deleteAsset, selectedAssetId, focusedAssetId]);

  const handleServicePart = useCallback(async (part: AssetPart, asset: FinGoAsset) => {
    await servicePart(part.id, asset.id, asset.current_usage);
  }, [servicePart]);

  // ─── Component handlers ───────────────────────────────────────────────────────

  /** "Add Component" / "Add sub-component" tapped on an asset accordion */
  const handleAddComponent = useCallback((asset: FinGoAsset, parentId: string | null) => {
    setPendingAsset(asset);
    setPendingParentId(parentId);
    setPendingTemplate(null);
    setLibraryForReplace(false);
    void loadStorageComponents(asset.type);
    setShowLibrary(true);
  }, [loadStorageComponents]);

  /** User picked something from the library */
  const handleLibrarySelect = useCallback(async (selection: { type: 'template'; template: ComponentTemplate } | { type: 'storage'; component: Component } | { type: 'custom'; name: string }) => {
    if (!pendingAsset) return;

    if (selection.type === 'storage') {
      // Reinstall directly
      await installComponent(selection.component.id, pendingAsset.id, pendingParentId);
      void loadAssets();
      return;
    }

    if (selection.type === 'custom') {
      setPendingTemplate(null);
      setPendingCustomName(selection.name);
      setShowComponentForm(true);
      return;
    }

    if (libraryForReplace && activeComponent) {
      // Replace: retire old, create new with selected template
      await replaceComponent(
        activeComponent,
        pendingAsset.id,
        pendingParentId,
        selection.template.key,
        selection.template.name,
      );
      setActiveComponent(null);
      setLibraryForReplace(false);
      void loadAssets();
      return;
    }

    // New component: open form pre-filled with template
    setPendingTemplate(selection.template);
    setPendingCustomName('');
    setShowComponentForm(true);
  }, [pendingAsset, pendingParentId, libraryForReplace, activeComponent, installComponent, replaceComponent, loadAssets]);

  /** Save from ComponentFormSheet */
  const handleComponentFormSave = useCallback(async (name: string, notes: string | null, installedAt: string | null, targetAssetId: string | null) => {
    if (!pendingAsset) return;
    const resolvedAssetId = targetAssetId ?? pendingAsset.id;
    const assetChanged = resolvedAssetId !== pendingAsset.id;

    if (activeComponent && !libraryForReplace) {
      // Edit mode — optionally move to different asset first
      if (assetChanged) {
        await moveComponent(activeComponent.id, pendingAsset.id, resolvedAssetId);
      }
      await updateComponent(activeComponent.id, resolvedAssetId, { name, notes, ...(installedAt ? { installed_at: installedAt } : {}) });
    } else {
      await createComponent(
        pendingAsset.id,
        pendingAsset.type,
        pendingParentId,
        pendingTemplate?.key ?? null,
        name,
        notes,
        installedAt ?? undefined,
      );
    }
    setActiveComponent(null);
    setPendingTemplate(null);
    void loadAssets();
  }, [pendingAsset, pendingParentId, pendingTemplate, activeComponent, libraryForReplace, updateComponent, createComponent, moveComponent, loadAssets]);

  /** Action sheet fired */
  const handleComponentAction = useCallback((action: ComponentActionType, component: Component, asset: FinGoAsset) => {
    setActiveComponent(component);
    setPendingAsset(asset);
    setPendingParentId(component.parent_component_id ?? null);

    switch (action) {
      case 'edit':
        setPendingTemplate(null);
        setShowComponentForm(true);
        break;

      case 'set_picture':
        // For now same as edit (picture_url field)
        setPendingTemplate(null);
        setShowComponentForm(true);
        break;

      case 'add_sub':
        setPendingParentId(component.id);
        setPendingTemplate(null);
        setLibraryForReplace(false);
        void loadStorageComponents(asset.type);
        setShowLibrary(true);
        break;

      case 'add_interval':
        setEditingInterval(null);
        setShowIntervalSheet(true);
        break;

      case 'log_service':
        setShowRecordSheet(true);
        break;

      case 'uninstall':
        void uninstallComponent(component.id, asset.id).then(() => void loadAssets());
        break;

      case 'install':
        void installComponent(component.id, asset.id, null).then(() => void loadAssets());
        break;

      case 'replace_same':
        void replaceComponent(
          component,
          asset.id,
          component.parent_component_id ?? null,
          component.template_key ?? null,
          component.name,
        ).then(() => void loadAssets());
        break;

      case 'replace_new':
        setLibraryForReplace(true);
        setPendingParentId(component.parent_component_id ?? null);
        void loadStorageComponents(asset.type);
        setShowLibrary(true);
        break;

      case 'retire':
        void retireComponent(component.id, asset.id).then(() => void loadAssets());
        break;

      case 'delete': {
        const doDelete = () => void deleteComponent(component.id, asset.id).then(() => void loadAssets());
        if (Platform.OS === 'web') {
          if (window.confirm(`Delete "${component.name}"? This cannot be undone.`)) doDelete();
        } else {
          Alert.alert('Delete component', `Delete "${component.name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: doDelete },
          ]);
        }
        break;
      }
    }
  }, [
    loadStorageComponents, uninstallComponent, installComponent,
    replaceComponent, retireComponent, deleteComponent, loadAssets,
  ]);

  const handleIntervalAction = useCallback((
    action: 'edit' | 'delete',
    interval: ComponentServiceInterval,
    component: Component,
    asset: FinGoAsset,
  ) => {
    if (action === 'edit') {
      setActiveComponent(component);
      setPendingAsset(asset);
      setEditingInterval(interval);
      setShowIntervalSheet(true);
    } else {
      const doDelete = () => void deleteInterval(interval.id, component.id).then(() => void loadAssets());
      if (Platform.OS === 'web') {
        if (window.confirm(`Delete "${interval.name}" interval?`)) doDelete();
      } else {
        Alert.alert('Delete interval', `Delete "${interval.name}"?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]);
      }
    }
  }, [deleteInterval, loadAssets]);

  const handleAddService = useCallback((asset: FinGoAsset) => {
    const allComponents = getAllComponents(asset.id);
    const gathered: IntervalWithComponent[] = [];
    for (const comp of allComponents) {
      for (const interval of (intervals[comp.id] ?? [])) {
        gathered.push({ interval, component: comp });
      }
    }
    setPendingAllIntervals(gathered);
    setPendingAsset(asset);
    setActiveComponent(null);
    setShowRecordSheet(true);
  }, [getAllComponents, intervals]);

  return (
    <View {...uiProps(uiPath('fingo', 'screen', 'container'))} style={styles.screen}>
      {/* Header */}
      <DashboardHeader
        onBack={() => {
          logUI(uiPath('fingo', 'header', 'back_button'), 'press');
          navigation.goBack();
        }}
        rightElement={
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'header', 'add_button'))}
            onPress={() => {
              logUI(uiPath('fingo', 'header', 'add_button'), 'press');
              openCreateAsset();
            }}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>＋</Text>
          </TouchableOpacity>
        }
      />

      {/* Pinned accordion header (outside ScrollView when an asset is focused) */}
      {focusedAsset && (
        <View style={styles.pinnedAccordionHeader}>
          <AssetAccordion
            asset={focusedAsset}
            user={user}
            parts={parts[focusedAsset.id] ?? []}
            componentTree={getTree(focusedAsset.id)}
            intervals={intervals}
            linkedCategoryIds={categoryLinks[focusedAsset.id] ?? []}
            transactions={transactions[focusedAsset.id] ?? []}
            usageLogs={logs[focusedAsset.id] ?? []}
            serviceRecords={recordsByAsset[focusedAsset.id] ?? []}
            categories={categories}
            onLogUsage={async (entry) => {
              await addUsageLog(focusedAsset, entry);
              await Promise.all([loadAssets(), loadComponents(focusedAsset.id)]);
            }}
            onEditLog={async (log, entry) => {
              await updateLog(log, focusedAsset, entry);
              await Promise.all([loadAssets(), loadComponents(focusedAsset.id)]);
            }}
            onServicePart={(part) => void handleServicePart(part, focusedAsset)}
            onLinkCategory={(catId) => void linkCategory(focusedAsset.id, catId)}
            onUnlinkCategory={(catId) => void unlinkCategory(focusedAsset.id, catId)}
            onDeleteAsset={(id) => void handleDeleteAsset(id)}
            onEditAsset={openEditAsset}
            onComponentAction={(action, component) => handleComponentAction(action, component, focusedAsset)}
            onIntervalAction={(action, interval, component) => handleIntervalAction(action, interval, component, focusedAsset)}
            onAddComponent={(parentId) => handleAddComponent(focusedAsset, parentId)}
            onComponentPress={(component) => navigation.push('ComponentDetail', { componentId: component.id, assetId: focusedAsset.id })}
            onIntervalPress={(interval, component) => navigation.push('ServiceIntervalDetail', { intervalId: interval.id, componentId: component.id, assetId: focusedAsset.id })}
            onAddService={() => handleAddService(focusedAsset)}
            expanded
            onToggle={collapseAccordion}
            headerOnly
          />
        </View>
      )}

      {/* Main scroll area */}
      <ScrollView
        {...uiProps(uiPath('fingo', 'screen', 'scroll_view'))}
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={focusedAsset ? styles.scrollContentFocused : styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && assets.length === 0 ? (
          <Text style={styles.loadingText}>Loading assets…</Text>
        ) : assets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No assets yet</Text>
            <Text style={styles.emptyHint}>
              Tap + to add your first asset — a car, bike, shoe, or anything with wearable parts.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={openCreateAsset}>
              <Text style={styles.emptyButtonText}>Add Asset</Text>
            </TouchableOpacity>
          </View>
        ) : focusedAsset ? (
          /* Focused: only the body scrolls */
          <AssetAccordion
            asset={focusedAsset}
            user={user}
            parts={parts[focusedAsset.id] ?? []}
            componentTree={getTree(focusedAsset.id)}
            intervals={intervals}
            linkedCategoryIds={categoryLinks[focusedAsset.id] ?? []}
            transactions={transactions[focusedAsset.id] ?? []}
            usageLogs={logs[focusedAsset.id] ?? []}
            serviceRecords={recordsByAsset[focusedAsset.id] ?? []}
            categories={categories}
            onLogUsage={async (entry) => {
              await addUsageLog(focusedAsset, entry);
              await Promise.all([loadAssets(), loadComponents(focusedAsset.id)]);
            }}
            onEditLog={async (log, entry) => {
              await updateLog(log, focusedAsset, entry);
              await Promise.all([loadAssets(), loadComponents(focusedAsset.id)]);
            }}
            onServicePart={(part) => void handleServicePart(part, focusedAsset)}
            onLinkCategory={(catId) => void linkCategory(focusedAsset.id, catId)}
            onUnlinkCategory={(catId) => void unlinkCategory(focusedAsset.id, catId)}
            onDeleteAsset={(id) => void handleDeleteAsset(id)}
            onEditAsset={openEditAsset}
            onComponentAction={(action, component) => handleComponentAction(action, component, focusedAsset)}
            onIntervalAction={(action, interval, component) => handleIntervalAction(action, interval, component, focusedAsset)}
            onAddComponent={(parentId) => handleAddComponent(focusedAsset, parentId)}
            onComponentPress={(component) => navigation.push('ComponentDetail', { componentId: component.id, assetId: focusedAsset.id })}
            onIntervalPress={(interval, component) => navigation.push('ServiceIntervalDetail', { intervalId: interval.id, componentId: component.id, assetId: focusedAsset.id })}
            onAddService={() => handleAddService(focusedAsset)}
            expanded
            onToggle={collapseAccordion}
            bodyOnly
          />
        ) : (
          <>
            <ServiceDashboard
              assets={assets}
              partsByAsset={parts}
              componentsByAsset={componentsByAsset}
              intervals={intervals}
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              onServicePart={handleServicePart}
              onLogServiceInterval={(_interval, component, asset) => {
                setActiveComponent(component);
                setPendingAsset(asset);
                setShowRecordSheet(true);
              }}
            />

            <Text style={styles.sectionLabel}>Your Assets</Text>
            {assets.map((asset) => (
              <View
                key={asset.id}
                onLayout={(e) => { accordionOffsets.current[asset.id] = e.nativeEvent.layout.y; }}
              >
                <AssetAccordion
                  asset={asset}
                  user={user}
                  parts={parts[asset.id] ?? []}
                  componentTree={getTree(asset.id)}
                  intervals={intervals}
                  linkedCategoryIds={categoryLinks[asset.id] ?? []}
                  transactions={transactions[asset.id] ?? []}
                  usageLogs={logs[asset.id] ?? []}
                  serviceRecords={recordsByAsset[asset.id] ?? []}
                  categories={categories}
                  onLogUsage={async (entry) => {
                    await addUsageLog(asset, entry);
                    await Promise.all([loadAssets(), loadComponents(asset.id)]);
                  }}
                  onEditLog={async (log, entry) => {
                    await updateLog(log, asset, entry);
                    await Promise.all([loadAssets(), loadComponents(asset.id)]);
                  }}
                  onServicePart={(part) => void handleServicePart(part, asset)}
                  onLinkCategory={(catId) => void linkCategory(asset.id, catId)}
                  onUnlinkCategory={(catId) => void unlinkCategory(asset.id, catId)}
                  onDeleteAsset={(id) => void handleDeleteAsset(id)}
                  onEditAsset={openEditAsset}
                  onComponentAction={(action, component) => {
                    handleComponentAction(action, component, asset);
                  }}
                  onIntervalAction={(action, interval, component) => {
                    handleIntervalAction(action, interval, component, asset);
                  }}
                  onAddComponent={(parentId) => handleAddComponent(asset, parentId)}
                  onComponentPress={(component) => {
                    navigation.push('ComponentDetail', {
                      componentId: component.id,
                      assetId: asset.id,
                    });
                  }}
                  onIntervalPress={(interval, component) => {
                    navigation.push('ServiceIntervalDetail', {
                      intervalId: interval.id,
                      componentId: component.id,
                      assetId: asset.id,
                    });
                  }}
                  onAddService={() => handleAddService(asset)}
                  expanded={false}
                  onToggle={() => {
                    setFocusedAssetId(asset.id);
                    setTimeout(() => {
                      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                    }, 50);
                  }}
                />
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Bottom bar */}
      <View {...uiProps(uiPath('fingo', 'bottom_bar', 'container'))} style={[styles.bottomBar, { paddingBottom: bottomInset(12, bottom) }]}>
        <TouchableOpacity
          {...uiProps(uiPath('fingo', 'bottom_bar', 'data_button'))}
          style={styles.bottomBarButton}
          onPress={() => {
            logUI(uiPath('fingo', 'bottom_bar', 'data_button'), 'press');
            navigation.push('HealthConnect');
          }}
        >
          <Text style={styles.bottomBarIcon}>💚</Text>
          <Text style={styles.bottomBarLabel}>Data</Text>
        </TouchableOpacity>
        <GoButton assetId={selectedAssetId} />
        <TouchableOpacity
          {...uiProps(uiPath('fingo', 'bottom_bar', 'stats_button'))}
          style={styles.bottomBarButton}
          onPress={() => logUI(uiPath('fingo', 'bottom_bar', 'stats_button'), 'press')}
        >
          <Text style={styles.bottomBarIcon}>📊</Text>
          <Text style={styles.bottomBarLabel}>Stats</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Asset Create/Edit Modal ────────────────────────────────────────────── */}
      <Modal visible={showAssetModal} transparent animationType="slide" onRequestClose={() => setShowAssetModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{editingAsset ? 'Edit Asset' : 'New Asset'}</Text>

            <TextInput
              {...uiProps(uiPath('fingo', 'asset_modal', 'name_input'))}
              style={styles.input}
              value={assetName}
              onChangeText={setAssetName}
              placeholder="Asset name (e.g. My Civic)"
              placeholderTextColor="#475569"
            />

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.optionRow}>
              {ASSET_TYPES.map((t) => (
                <TouchableOpacity
                  {...uiProps(uiPath('fingo', 'asset_modal', 'type_option', t))}
                  key={t}
                  style={[styles.optionButton, assetType === t && styles.optionButtonActive]}
                  onPress={() => { logUI(uiPath('fingo', 'asset_modal', 'type_option', t), 'press'); setAssetType(t); }}
                >
                  <Text style={[styles.optionText, assetType === t && styles.optionTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.activeToggle, assetIsActive && styles.activeToggleOn]}
              onPress={() => setAssetIsActive((v) => !v)}
            >
              <View style={[styles.activeToggleDot, assetIsActive && styles.activeToggleDotOn]} />
              <Text style={[styles.activeToggleText, assetIsActive && styles.activeToggleTextOn]}>
                Set as active {assetType === 'shoe' ? 'shoe' : assetType === 'bike' ? 'bike' : 'vehicle'} (auto-sync from Health Connect)
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAssetModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, (!assetName.trim() || assetSaving) && styles.submitDisabled]}
                onPress={() => void handleSaveAsset()}
                disabled={!assetName.trim() || assetSaving}
              >
                <Text style={styles.submitText}>{assetSaving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Component sheets ────────────────────────────────────────────────────── */}
      <ComponentLibrarySheet
        visible={showLibrary}
        assetType={pendingAsset?.type ?? 'other'}
        assetName={pendingAsset?.name}
        installedComponents={pendingAsset ? getAllComponents(pendingAsset.id) : []}
        storageComponents={storageComponents}
        onSelect={(sel) => void handleLibrarySelect(sel)}
        onClose={() => { setShowLibrary(false); setLibraryForReplace(false); }}
      />

      <ComponentFormSheet
        visible={showComponentForm}
        template={pendingTemplate}
        editingComponent={activeComponent && !libraryForReplace ? activeComponent : null}
        initialName={pendingCustomName}
        assetCreatedAt={pendingAsset?.created_at}
        assetName={pendingAsset?.name}
        assets={assets.map((a) => ({ id: a.id, name: a.name }))}
        currentAssetId={pendingAsset?.id}
        onSave={handleComponentFormSave}
        onClose={() => { setShowComponentForm(false); setActiveComponent(null); setPendingTemplate(null); setPendingCustomName(''); }}
      />

      <ServiceIntervalSheet
        visible={showIntervalSheet}
        componentName={activeComponent?.name}
        editingInterval={editingInterval}
        onSave={async (name, method, value, serviceType) => {
          if (!activeComponent) return;
          if (editingInterval) {
            await updateInterval(editingInterval.id, activeComponent.id, { name, tracking_method: method, interval_value: value, service_type: serviceType });
          } else {
            await createInterval(activeComponent.id, name, method, value, serviceType);
          }
          void loadAssets();
        }}
        onClose={() => { setShowIntervalSheet(false); setEditingInterval(null); }}
      />

      <ServiceRecordSheet
        visible={showRecordSheet}
        componentName={activeComponent?.name}
        intervals={activeComponent ? (intervals[activeComponent.id] ?? []) : []}
        component={activeComponent}
        allIntervals={pendingAllIntervals.length > 0 ? pendingAllIntervals : undefined}
        onSave={async (name, servicedAt, notes, cost, selectedIntervalIds) => {
          if (!pendingAsset) return;
          if (pendingAllIntervals.length > 0) {
            // Asset-level service: save one record per selected component
            const selectedItems = pendingAllIntervals.filter((x) => selectedIntervalIds.includes(x.interval.id));
            const byComponent = new Map<string, { component: Component; intervalIds: string[] }>();
            for (const { interval, component: comp } of selectedItems) {
              const existing = byComponent.get(comp.id);
              if (existing) existing.intervalIds.push(interval.id);
              else byComponent.set(comp.id, { component: comp, intervalIds: [interval.id] });
            }
            await Promise.all(
              Array.from(byComponent.values()).map(async ({ component: comp, intervalIds }) => {
                await createRecord(pendingAsset.id, comp.id, name, servicedAt, notes, cost);
                await Promise.all(
                  intervalIds.map((id) => {
                    const iv = pendingAllIntervals.find((x) => x.interval.id === id)?.interval;
                    if (!iv) return Promise.resolve(false);
                    const currentValue = getTrackingValue(comp, iv.tracking_method);
                    return markServiced(id, comp.id, currentValue);
                  }),
                );
              }),
            );
          } else {
            await createRecord(pendingAsset.id, activeComponent?.id ?? null, name, servicedAt, notes, cost);
            if (activeComponent && selectedIntervalIds.length > 0) {
              const componentIntervals = intervals[activeComponent.id] ?? [];
              await Promise.all(
                selectedIntervalIds.map((id) => {
                  const interval = componentIntervals.find((i) => i.id === id);
                  if (!interval) return Promise.resolve(false);
                  const currentValue = getTrackingValue(activeComponent, interval.tracking_method);
                  return markServiced(id, activeComponent.id, currentValue);
                }),
              );
            }
          }
          void loadAssets();
        }}
        onClose={() => { setShowRecordSheet(false); setPendingAllIntervals([]); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#060D18',
  },
  addButton: {
    width: 32,
    alignItems: 'flex-end',
  },
  addButtonText: {
    color: '#4ade80',
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 24,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  scrollContentFocused: {
    paddingTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  pinnedAccordionHeader: {
    paddingHorizontal: 16,
  },
  loadingText: {
    color: '#475569',
    textAlign: 'center',
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    color: '#CBD5E1',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyHint: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyButton: {
    marginTop: 10,
    backgroundColor: '#053d1e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4ade80',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: '#4ade80',
    fontWeight: '700',
  },
  sectionLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#07111F',
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 12,
  },
  bottomBarButton: {
    alignItems: 'center',
    width: 48,
  },
  bottomBarIcon: { fontSize: 20 },
  bottomBarLabel: {
    color: '#475569',
    fontSize: 10,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
  },
  modalTitle: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    color: '#CBD5E1',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  fieldLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  optionButtonActive: {
    backgroundColor: '#0D2137',
    borderColor: '#3B6A9E',
  },
  optionText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  optionTextActive: { color: '#8FA8C9' },
  activeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  activeToggleOn: {
    borderColor: '#4ade80',
    backgroundColor: '#053d1e',
  },
  activeToggleDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0B1728',
  },
  activeToggleDotOn: {
    borderColor: '#4ade80',
    backgroundColor: '#4ade80',
  },
  activeToggleText: {
    flex: 1,
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  activeToggleTextOn: {
    color: '#4ade80',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  cancelText: { color: '#64748B', fontWeight: '600' },
  submitButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#053d1e',
    borderWidth: 1,
    borderColor: '#4ade80',
    alignItems: 'center',
  },
  submitDisabled: {
    backgroundColor: '#0E1A2B',
    borderColor: '#1F3A59',
  },
  submitText: { color: '#4ade80', fontWeight: '700' },
});
