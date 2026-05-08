// FinGo — Asset Lifecycle Manager types

export type AssetType = 'vehicle' | 'motorbike' | 'bike' | 'shoe' | 'other';
export type AssetMemberRole = 'owner' | 'member';
export type UsageSource = 'odometer' | 'health_connect' | 'gps';
export type FinGoSortOrder = 'deadline' | 'name' | 'priority';
export type TrackingMethod = 'distance' | 'moving_time' | 'elapsed_time' | 'rides' | 'elevation_gain';
export type ComponentStatus = 'installed' | 'storage' | 'retired';

// ─── Core entities ────────────────────────────────────────────────────────────

export type FinGoAsset = {
  id: string;
  created_by: string;
  name: string;
  type: AssetType;
  usage_unit: string;    // kept for DB compat; no longer shown in UI
  current_usage: number;
  total_distance: number;
  total_moving_time: number; // minutes
  total_elevation: number;   // meters
  total_rides: number;
  total_steps: number;
  icon?: string | null;
  notes?: string | null;
  created_at: string;
};

export type AssetMember = {
  id: string;
  asset_id: string;
  user_id: string;
  role: AssetMemberRole;
  invited_by?: string | null;
  joined_at: string;
  // enriched client-side
  display_name?: string | null;
  avatar_url?: string | null;
};

export type AssetPart = {
  id: string;
  asset_id: string;
  name: string;
  usage_unit: string;          // own unit, independent of parent asset's unit
  reset_interval: number;
  usage_at_last_reset: number;
  priority: number;            // 1–10
  warn_at_pct: number;         // default 0.8
  notes?: string | null;
  created_at: string;
};

export type AssetCategory = {
  asset_id: string;
  category_id: string;
};

export type UsageLog = {
  id: string;
  asset_id: string;
  recorded_by: string;
  usage_delta: number;
  usage_after: number;
  moving_time_delta?: number | null;  // minutes (bike, vehicle)
  elevation_delta?: number | null;    // meters (bike)
  source: UsageSource;
  recorded_at: string;
  linked_expense_id?: string | null;
  notes?: string | null;
};

/** Structured usage data captured per-log entry, fields vary by asset type */
export type UsageEntry = {
  distance?: number;     // km — bike, vehicle
  movingTime?: number;   // minutes — bike, vehicle
  elevation?: number;    // meters — bike (optional)
  steps?: number;        // count — shoe
  notes?: string;
};

export type PartServiceLog = {
  id: string;
  part_id: string;
  usage_at_service: number;
  serviced_at: string;
  linked_expense_id?: string | null;
  notes?: string | null;
};

// ─── Derived / computed ───────────────────────────────────────────────────────

/** Client-side computed health metrics for a part */
export type PartHealth = {
  part: AssetPart;
  /** 1.0 = fresh, 0.0 = at/past interval, negative = overdue */
  healthRatio: number;
  /** Usage units remaining until service (may be negative if overdue) */
  remaining: number;
  /** Whether the warn threshold has been crossed */
  isWarning: boolean;
  /** Whether the part is at or past its service interval */
  isOverdue: boolean;
};

/** Asset with its parts and computed health, ready for UI rendering */
export type AssetWithHealth = {
  asset: FinGoAsset;
  parts: PartHealth[];
  members: AssetMember[];
  linkedCategoryIds: string[];
};

// ─── Component entities ───────────────────────────────────────────────────────

export type Component = {
  id: string;
  created_by: string;
  template_key?: string | null;
  name: string;
  asset_type: AssetType;
  installed_on_asset_id?: string | null;
  parent_component_id?: string | null;
  status: ComponentStatus;
  installed_at?: string | null;
  track_distance: number;
  track_moving_time: number;
  track_elapsed_time: number;
  track_rides: number;
  track_elevation_gain: number;
  picture_url?: string | null;
  notes?: string | null;
  position: number;
  created_at: string;
};

export type ComponentServiceInterval = {
  id: string;
  component_id: string;
  name: string;
  tracking_method: TrackingMethod;
  interval_value: number;
  last_serviced_value: number;
  created_at: string;
};

export type ComponentServiceRecord = {
  id: string;
  component_id?: string | null;
  asset_id: string;
  name: string;
  serviced_at: string;
  notes?: string | null;
  cost?: number | null;
  created_by: string;
  created_at: string;
};

export type ComponentTemplate = {
  key: string;
  name: string;
  category: string;
};

/** A component node in the client-side tree (flat list → nested by parent_component_id) */
export type ComponentNode = {
  component: Component;
  children: ComponentNode[];
};

/** Computed health for one service interval */
export type IntervalHealth = {
  interval: ComponentServiceInterval;
  /** Total tracking units accumulated since last service */
  totalSinceService: number;
  /** Units remaining until service is due (negative = overdue) */
  remaining: number;
  isWarning: boolean;
  isOverdue: boolean;
};
