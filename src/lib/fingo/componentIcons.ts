import { findTemplate } from './componentTemplates';

/** Maps template_key → icon key (bike SVG name or Lucide name) */
const TEMPLATE_KEY_ICONS: Record<string, string> = {
  // ── Bike: Drivetrain ──────────────────────────────────────────────────────
  chain:              'chain',
  cassette:           'cassette',
  chainring:          'cassette',
  front_derailleur:   'derailleur',
  rear_derailleur:    'derailleur',
  shifter_left:       'derailleur',
  shifter_right:      'derailleur',
  cable_shift:        'wrench',
  // ── Bike: Braking ─────────────────────────────────────────────────────────
  brake_pads_front:   'brake-rotor',
  brake_pads_rear:    'brake-rotor',
  brake_rotor_front:  'brake-rotor',
  brake_rotor_rear:   'brake-rotor',
  cable_brake:        'wrench',
  // ── Bike: Wheels ──────────────────────────────────────────────────────────
  tyre_front:         'tire',
  tyre_rear:          'tire',
  inner_tube_front:   'tire',
  inner_tube_rear:    'tire',
  rim_front:          'tire',
  rim_rear:           'tire',
  spokes_front:       'tire',
  spokes_rear:        'tire',
  // ── Bike: Bearings ────────────────────────────────────────────────────────
  bearings_bb:        'cassette',
  bearings_headset:   'cassette',
  bearings_wheel_f:   'cassette',
  bearings_wheel_r:   'cassette',
  bearings_pedal:     'cassette',
  // ── Bike: Cockpit ─────────────────────────────────────────────────────────
  handlebar:          'handlebar',
  stem:               'handlebar',
  grips:              'handlebar',
  // ── Bike: Contact ─────────────────────────────────────────────────────────
  saddle:             'saddle',
  seatpost:           'saddle',
  pedals:             'box',
  cleats:             'box',
  // ── Bike: Frame ───────────────────────────────────────────────────────────
  frame:              'fork',
  fork:               'fork',
  // ── Bike: Suspension ──────────────────────────────────────────────────────
  suspension_fork:    'fork',
  shock_rear:         'sliders',
  // ── Bike: Electronics ─────────────────────────────────────────────────────
  battery:            'battery',
  motor:              'zap',
  sensor_speed:       'gauge',
  sensor_cadence:     'gauge',
  sensor_power:       'gauge',
  // ── Bike: Accessories ─────────────────────────────────────────────────────
  lights_front:       'lightbulb',
  lights_rear:        'lightbulb',
  mudguard_front:     'package',
  mudguard_rear:      'package',
  rack:               'package',
  kickstand:          'package',
  // ── Vehicle: Engine ───────────────────────────────────────────────────────
  engine_oil:         'droplets',
  oil_filter:         'filter',
  air_filter:         'filter',
  fuel_filter:        'filter',
  spark_plugs:        'zap',
  timing_belt:        'chain',
  timing_chain:       'chain',
  // ── Vehicle: Cooling ──────────────────────────────────────────────────────
  coolant:            'thermometer',
  thermostat:         'thermometer',
  water_pump:         'droplets',
  // ── Vehicle: Braking ──────────────────────────────────────────────────────
  brake_pads_fl:      'brake-rotor',
  brake_pads_fr:      'brake-rotor',
  brake_pads_rl:      'brake-rotor',
  brake_pads_rr:      'brake-rotor',
  brake_disc_fl:      'brake-rotor',
  brake_disc_fr:      'brake-rotor',
  brake_disc_rl:      'brake-rotor',
  brake_disc_rr:      'brake-rotor',
  brake_fluid:        'droplets',
  // ── Vehicle: Tyres ────────────────────────────────────────────────────────
  tyre_fl:            'tire',
  tyre_fr:            'tire',
  tyre_rl:            'tire',
  tyre_rr:            'tire',
  // ── Vehicle: Electrical ───────────────────────────────────────────────────
  alternator:         'zap',
  starter_motor:      'zap',
  // ── Vehicle: Transmission ─────────────────────────────────────────────────
  transmission_fluid: 'droplets',
  clutch:             'cassette',
  gearbox_fluid:      'droplets',
  // ── Vehicle: Suspension ───────────────────────────────────────────────────
  shock_fl:           'sliders',
  shock_fr:           'sliders',
  shock_rl:           'sliders',
  shock_rr:           'sliders',
  // ── Vehicle: Steering / Visibility ────────────────────────────────────────
  power_steering_fluid: 'droplets',
  wiper_front:        'eye',
  wiper_rear:         'eye',
  // ── Shoe ──────────────────────────────────────────────────────────────────
  insole:             'box',
  laces:              'box',
  outsole:            'box',
  midsole:            'box',
  heel_cap:           'box',
  toe_box:            'box',
  upper:              'box',
  // ── Generic ───────────────────────────────────────────────────────────────
  generic_part:       'box',
  generic_filter:     'filter',
  generic_fluid:      'droplets',
  generic_battery:    'battery',
};

/** Keyword fallback for custom-named components */
const KEYWORD_ICON_MAP: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ['chain'],                                                        icon: 'chain' },
  { keywords: ['cassette', 'chainring', 'sprocket', 'crankset'],               icon: 'cassette' },
  { keywords: ['derailleur', 'shifter'],                                        icon: 'derailleur' },
  { keywords: ['brake', 'pad', 'rotor', 'disc', 'caliper'],                    icon: 'brake-rotor' },
  { keywords: ['tyre', 'tire', 'tube', 'rim', 'spoke', 'wheel'],               icon: 'tire' },
  { keywords: ['fork', 'frame'],                                                icon: 'fork' },
  { keywords: ['suspension', 'shock', 'damper'],                               icon: 'sliders' },
  { keywords: ['handlebar', 'stem', 'grip', 'bar tape', 'cockpit'],            icon: 'handlebar' },
  { keywords: ['saddle', 'seat', 'seatpost'],                                  icon: 'saddle' },
  { keywords: ['bearing', 'headset', 'hub', 'bottom bracket'],                 icon: 'cassette' },
  { keywords: ['battery'],                                                      icon: 'battery' },
  { keywords: ['motor', 'alternator', 'starter', 'electric', 'spark'],         icon: 'zap' },
  { keywords: ['sensor', 'speed', 'cadence', 'power meter', 'computer'],       icon: 'gauge' },
  { keywords: ['light', 'lamp'],                                                icon: 'lightbulb' },
  { keywords: ['wiper', 'visibility'],                                          icon: 'eye' },
  { keywords: ['oil', 'fluid', 'coolant', 'lubricant'],                        icon: 'droplets' },
  { keywords: ['filter'],                                                       icon: 'filter' },
  { keywords: ['thermostat', 'temperature'],                                    icon: 'thermometer' },
  { keywords: ['engine', 'timing'],                                             icon: 'wrench' },
  { keywords: ['rack', 'mudguard', 'fender', 'kickstand'],                     icon: 'package' },
];

/**
 * Returns an icon key for the given component.
 * Keys match either a BikeIconName (custom SVG) or a Lucide icon name.
 * Check template_key first, then keyword-scan the display name.
 */
export function getComponentIcon(name: string, templateKey?: string | null): string {
  if (templateKey) {
    const direct = TEMPLATE_KEY_ICONS[templateKey];
    if (direct) return direct;

    const tmpl = findTemplate(templateKey);
    if (tmpl) {
      const cat = tmpl.category.toLowerCase();
      if (cat.includes('drivetrain') || cat.includes('transmission')) return 'cassette';
      if (cat.includes('braking')) return 'brake-rotor';
      if (cat.includes('wheel') || cat.includes('tyre') || cat.includes('tire')) return 'tire';
      if (cat.includes('suspension')) return 'sliders';
      if (cat.includes('electric') || cat.includes('electron')) return 'zap';
      if (cat.includes('engine')) return 'wrench';
    }
  }

  const lower = name.toLowerCase();
  for (const { keywords, icon } of KEYWORD_ICON_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return icon;
  }

  return 'box';
}
