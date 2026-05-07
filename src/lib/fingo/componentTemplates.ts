/**
 * FinGo — static component library, keyed by asset type.
 * These templates pre-fill the ComponentFormSheet when adding a new component.
 */

import type { AssetType, ComponentTemplate } from '../../types/fingo';

const BIKE_TEMPLATES: ComponentTemplate[] = [
  // Drivetrain
  { key: 'chain',             name: 'Chain',               category: 'Drivetrain' },
  { key: 'cassette',          name: 'Cassette',             category: 'Drivetrain' },
  { key: 'chainring',         name: 'Chainring',            category: 'Drivetrain' },
  { key: 'front_derailleur',  name: 'Front Derailleur',     category: 'Drivetrain' },
  { key: 'rear_derailleur',   name: 'Rear Derailleur',      category: 'Drivetrain' },
  { key: 'shifter_left',      name: 'Left Shifter',         category: 'Drivetrain' },
  { key: 'shifter_right',     name: 'Right Shifter',        category: 'Drivetrain' },
  { key: 'cable_shift',       name: 'Shift Cable',          category: 'Drivetrain' },
  // Braking
  { key: 'brake_pads_front',  name: 'Front Brake Pads',     category: 'Braking' },
  { key: 'brake_pads_rear',   name: 'Rear Brake Pads',      category: 'Braking' },
  { key: 'brake_rotor_front', name: 'Front Brake Rotor',    category: 'Braking' },
  { key: 'brake_rotor_rear',  name: 'Rear Brake Rotor',     category: 'Braking' },
  { key: 'cable_brake',       name: 'Brake Cable',          category: 'Braking' },
  // Wheels
  { key: 'tyre_front',        name: 'Front Tyre',           category: 'Wheels' },
  { key: 'tyre_rear',         name: 'Rear Tyre',            category: 'Wheels' },
  { key: 'inner_tube_front',  name: 'Front Inner Tube',     category: 'Wheels' },
  { key: 'inner_tube_rear',   name: 'Rear Inner Tube',      category: 'Wheels' },
  { key: 'rim_front',         name: 'Front Rim',            category: 'Wheels' },
  { key: 'rim_rear',          name: 'Rear Rim',             category: 'Wheels' },
  { key: 'spokes_front',      name: 'Front Spokes',         category: 'Wheels' },
  { key: 'spokes_rear',       name: 'Rear Spokes',          category: 'Wheels' },
  // Bearings
  { key: 'bearings_bb',       name: 'Bottom Bracket',       category: 'Bearings' },
  { key: 'bearings_headset',  name: 'Headset Bearings',     category: 'Bearings' },
  { key: 'bearings_wheel_f',  name: 'Front Hub Bearings',   category: 'Bearings' },
  { key: 'bearings_wheel_r',  name: 'Rear Hub Bearings',    category: 'Bearings' },
  { key: 'bearings_pedal',    name: 'Pedal Bearings',       category: 'Bearings' },
  // Cockpit
  { key: 'handlebar',         name: 'Handlebar',            category: 'Cockpit' },
  { key: 'stem',              name: 'Stem',                 category: 'Cockpit' },
  { key: 'grips',             name: 'Grips / Bar Tape',     category: 'Cockpit' },
  // Contact
  { key: 'saddle',            name: 'Saddle',               category: 'Contact' },
  { key: 'seatpost',          name: 'Seatpost',             category: 'Contact' },
  { key: 'pedals',            name: 'Pedals',               category: 'Contact' },
  { key: 'cleats',            name: 'Cleats',               category: 'Contact' },
  // Frame
  { key: 'frame',             name: 'Frame',                category: 'Frame' },
  { key: 'fork',              name: 'Fork',                 category: 'Frame' },
  // Suspension
  { key: 'suspension_fork',   name: 'Suspension Fork',      category: 'Suspension' },
  { key: 'shock_rear',        name: 'Rear Shock',           category: 'Suspension' },
  // Electronics
  { key: 'battery',           name: 'Battery',              category: 'Electronics' },
  { key: 'motor',             name: 'Motor',                category: 'Electronics' },
  { key: 'sensor_speed',      name: 'Speed Sensor',         category: 'Electronics' },
  { key: 'sensor_cadence',    name: 'Cadence Sensor',       category: 'Electronics' },
  { key: 'sensor_power',      name: 'Power Meter',          category: 'Electronics' },
  // Accessories
  { key: 'lights_front',      name: 'Front Light',          category: 'Accessories' },
  { key: 'lights_rear',       name: 'Rear Light',           category: 'Accessories' },
  { key: 'mudguard_front',    name: 'Front Mudguard',       category: 'Accessories' },
  { key: 'mudguard_rear',     name: 'Rear Mudguard',        category: 'Accessories' },
  { key: 'rack',              name: 'Rack',                 category: 'Accessories' },
  { key: 'kickstand',         name: 'Kickstand',            category: 'Accessories' },
];

const VEHICLE_TEMPLATES: ComponentTemplate[] = [
  // Engine
  { key: 'engine_oil',        name: 'Engine Oil',           category: 'Engine' },
  { key: 'oil_filter',        name: 'Oil Filter',           category: 'Engine' },
  { key: 'air_filter',        name: 'Air Filter',           category: 'Engine' },
  { key: 'fuel_filter',       name: 'Fuel Filter',          category: 'Engine' },
  { key: 'spark_plugs',       name: 'Spark Plugs',          category: 'Engine' },
  { key: 'timing_belt',       name: 'Timing Belt',          category: 'Engine' },
  { key: 'timing_chain',      name: 'Timing Chain',         category: 'Engine' },
  // Cooling
  { key: 'coolant',           name: 'Coolant',              category: 'Cooling' },
  { key: 'thermostat',        name: 'Thermostat',           category: 'Cooling' },
  { key: 'water_pump',        name: 'Water Pump',           category: 'Cooling' },
  // Braking
  { key: 'brake_pads_fl',     name: 'Front Left Brake Pads',  category: 'Braking' },
  { key: 'brake_pads_fr',     name: 'Front Right Brake Pads', category: 'Braking' },
  { key: 'brake_pads_rl',     name: 'Rear Left Brake Pads',   category: 'Braking' },
  { key: 'brake_pads_rr',     name: 'Rear Right Brake Pads',  category: 'Braking' },
  { key: 'brake_disc_fl',     name: 'Front Left Brake Disc',  category: 'Braking' },
  { key: 'brake_disc_fr',     name: 'Front Right Brake Disc', category: 'Braking' },
  { key: 'brake_disc_rl',     name: 'Rear Left Brake Disc',   category: 'Braking' },
  { key: 'brake_disc_rr',     name: 'Rear Right Brake Disc',  category: 'Braking' },
  { key: 'brake_fluid',       name: 'Brake Fluid',          category: 'Braking' },
  // Tyres
  { key: 'tyre_fl',           name: 'Front Left Tyre',      category: 'Tyres' },
  { key: 'tyre_fr',           name: 'Front Right Tyre',     category: 'Tyres' },
  { key: 'tyre_rl',           name: 'Rear Left Tyre',       category: 'Tyres' },
  { key: 'tyre_rr',           name: 'Rear Right Tyre',      category: 'Tyres' },
  // Electrical
  { key: 'battery',           name: 'Battery',              category: 'Electrical' },
  { key: 'alternator',        name: 'Alternator',           category: 'Electrical' },
  { key: 'starter_motor',     name: 'Starter Motor',        category: 'Electrical' },
  // Transmission
  { key: 'transmission_fluid', name: 'Transmission Fluid',  category: 'Transmission' },
  { key: 'clutch',            name: 'Clutch',               category: 'Transmission' },
  { key: 'gearbox_fluid',     name: 'Gearbox Fluid',        category: 'Transmission' },
  // Suspension
  { key: 'shock_fl',          name: 'Front Left Shock',     category: 'Suspension' },
  { key: 'shock_fr',          name: 'Front Right Shock',    category: 'Suspension' },
  { key: 'shock_rl',          name: 'Rear Left Shock',      category: 'Suspension' },
  { key: 'shock_rr',          name: 'Rear Right Shock',     category: 'Suspension' },
  // Steering
  { key: 'power_steering_fluid', name: 'Power Steering Fluid', category: 'Steering' },
  // Visibility
  { key: 'wiper_front',       name: 'Front Wipers',         category: 'Visibility' },
  { key: 'wiper_rear',        name: 'Rear Wiper',           category: 'Visibility' },
];

const SHOE_TEMPLATES: ComponentTemplate[] = [
  { key: 'insole',    name: 'Insole',    category: 'Interior' },
  { key: 'laces',     name: 'Laces',     category: 'Closure' },
  { key: 'outsole',   name: 'Outsole',   category: 'Sole' },
  { key: 'midsole',   name: 'Midsole',   category: 'Sole' },
  { key: 'heel_cap',  name: 'Heel Cap',  category: 'Structure' },
  { key: 'toe_box',   name: 'Toe Box',   category: 'Structure' },
  { key: 'upper',     name: 'Upper',     category: 'Structure' },
];

const OTHER_TEMPLATES: ComponentTemplate[] = [
  { key: 'generic_part',    name: 'Part',    category: 'General' },
  { key: 'generic_filter',  name: 'Filter',  category: 'General' },
  { key: 'generic_fluid',   name: 'Fluid',   category: 'General' },
  { key: 'generic_battery', name: 'Battery', category: 'General' },
];

export const COMPONENT_TEMPLATES: Record<AssetType, ComponentTemplate[]> = {
  bike:    BIKE_TEMPLATES,
  vehicle: VEHICLE_TEMPLATES,
  shoe:    SHOE_TEMPLATES,
  other:   OTHER_TEMPLATES,
};

/** Returns templates grouped by category for a given asset type */
export function getTemplates(
  assetType: AssetType,
): { category: string; items: ComponentTemplate[] }[] {
  const templates = COMPONENT_TEMPLATES[assetType] ?? OTHER_TEMPLATES;
  const map = new Map<string, ComponentTemplate[]>();
  for (const t of templates) {
    if (!map.has(t.category)) map.set(t.category, []);
    map.get(t.category)!.push(t);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

/** Find a template by key across all asset types */
export function findTemplate(key: string): ComponentTemplate | undefined {
  for (const templates of Object.values(COMPONENT_TEMPLATES)) {
    const found = templates.find((t) => t.key === key);
    if (found) return found;
  }
  return undefined;
}
