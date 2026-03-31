import { useCallback, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { isMissingColumnError } from '../types/dashboard';
import type { AppAccount } from '../types/dashboard';
import type { User } from '@supabase/supabase-js';

// Capture native timer functions before they get shadowed
const _setInterval = setInterval;
const _clearInterval = clearInterval;

/**
 * Thin UI-state layer for the dashboard.
 * All data fetching is now handled by the dedicated query hooks.
 * This hook owns only: selection state, saving/animation flags, and refs.
 */
export function useDashboardData(user: User | null) {
  // ── Selection / account state ──
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [primaryAccountId, setPrimaryAccountId] = useState<string | null>(null);
  const [excludedAccountIds, setExcludedAccountIds] = useState<string[]>([]);
  const [entryAccountId, setEntryAccountId] = useState<string | null>(null);

  // ── Async operation state ──
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  /** 0→1 multiplier applied to displayed numbers during the count-up animation after a reload. */
  const [animMultiplier, setAnimMultiplier] = useState(1);
  const [missingSchemaColumns, setMissingSchemaColumns] = useState<string[]>([]);

  // ── Refs ──
  const pendingSelectedAccountIdRef = useRef<string | null>(null);
  const schemaAlertSignatureRef = useRef('');
  const animIntervalRef = useRef<ReturnType<typeof _setInterval> | null>(null);

  /** Persist account order + primary selection to database (+ local cache). */
  const saveAccountPrefs = useCallback(
    (orderedAccounts: AppAccount[], primaryId: string | null, excluded?: string[]) => {
      if (!user) return;
      const order = orderedAccounts.map((a) => a.id);
      const payload: any = {
        user_id: user.id,
        account_order: order,
        primary_account_id: primaryId,
        updated_at: new Date().toISOString(),
      };
      if (excluded !== undefined) payload.excluded_account_ids = excluded;
      void supabase.from('user_preferences').upsert(payload);
      void AsyncStorage.setItem(
        `finduo_account_prefs_${user.id}`,
        JSON.stringify({ order, primaryId }),
      );
    },
    [user],
  );

  /** Counts displayed numbers up from 0 → actual value over ~200 ms (ease-out cubic). */
  const animateIn = useCallback(() => {
    if (animIntervalRef.current) _clearInterval(animIntervalRef.current);
    setReloading(false);
    setAnimMultiplier(0);
    let step = 0;
    const STEPS = 20;
    const INTERVAL_MS = 200 / STEPS;
    animIntervalRef.current = _setInterval(() => {
      step += 1;
      const t = step / STEPS;
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      if (step >= STEPS) {
        setAnimMultiplier(1);
        _clearInterval(animIntervalRef.current!);
        animIntervalRef.current = null;
      } else {
        setAnimMultiplier(eased);
      }
    }, INTERVAL_MS);
  }, []);

  const checkRequiredSchemaColumns = useCallback(async () => {
    const missing: string[] = [];

    const checks = await Promise.all([
      supabase.from('account_settings').select('carry_over_balance').limit(1),
      supabase.from('account_invites').select('name').limit(1),
      supabase.from('accounts').select('icon').limit(1),
      supabase.from('tags').select('icon').limit(1),
    ]);

    const names = [
      'account_settings.carry_over_balance',
      'account_invites.name',
      'accounts.icon',
      'tags.icon',
    ];

    for (let i = 0; i < checks.length; i++) {
      if (checks[i].error && isMissingColumnError(checks[i].error!)) {
        missing.push(names[i]);
      }
    }

    setMissingSchemaColumns(missing);
  }, []);

  return {
    // Selection
    selectedAccountId,
    setSelectedAccountId,
    primaryAccountId,
    setPrimaryAccountId,
    entryAccountId,
    setEntryAccountId,
    excludedAccountIds,
    setExcludedAccountIds,

    // Async state
    saving,
    setSaving,
    reloading,
    setReloading,
    animMultiplier,
    missingSchemaColumns,

    // Refs
    pendingSelectedAccountIdRef,
    schemaAlertSignatureRef,

    // Actions
    saveAccountPrefs,
    animateIn,
    checkRequiredSchemaColumns,
  };
}
