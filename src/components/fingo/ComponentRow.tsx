import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { AssetType, Component, ComponentNode, ComponentServiceInterval } from '../../types/fingo';
import {
  worstIntervalHealth, formatIntervalRemaining, healthColor,
} from '../../lib/fingo/health';
import { findTemplate } from '../../lib/fingo/componentTemplates';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

interface Props {
  node: ComponentNode;
  depth?: number;
  assetId: string;
  assetType: AssetType;
  intervals: Record<string, ComponentServiceInterval[]>;
  onShowActions: (component: Component) => void;
  onAddChild: (parentId: string) => void;
}

export default function ComponentRow({
  node, depth = 0, assetId, assetType, intervals, onShowActions, onAddChild,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const { component, children } = node;
  const indent = depth * 16;

  const componentIntervals = intervals[component.id] ?? [];
  const worst = worstIntervalHealth(componentIntervals, component);
  const template = component.template_key ? findTemplate(component.template_key) : null;

  return (
    <View>
      <View
        {...uiProps(uiPath('fingo', 'component_row', 'container', component.id))}
        style={[styles.row, { marginLeft: indent }]}
      >
        {/* Expand / collapse toggle */}
        {children.length > 0 ? (
          <TouchableOpacity
            style={styles.expandBtn}
            onPress={() => {
              logUI(uiPath('fingo', 'component_row', 'expand', component.id), 'press');
              setExpanded((v) => !v);
            }}
          >
            <Text style={styles.expandIcon}>{expanded ? '▾' : '▸'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.expandBtn}>
            <View style={styles.leafDot} />
          </View>
        )}

        {/* Main content */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>{component.name}</Text>
            {template && (
              <View style={styles.categoryTag}>
                <Text style={styles.categoryText}>{template.category}</Text>
              </View>
            )}
          </View>

          {/* Worst service interval badge */}
          {worst && (
            <View style={styles.healthRow}>
              <View style={[styles.healthDot, { backgroundColor: healthColor(
                worst.isOverdue ? 0 : 1 - worst.totalSinceService / worst.interval.interval_value,
              ) }]} />
              <Text style={[styles.healthText, worst.isOverdue && styles.overdueText]}>
                {worst.isOverdue
                  ? `${worst.interval.name} — Overdue`
                  : `${worst.interval.name} — ${formatIntervalRemaining(worst)} left`}
              </Text>
            </View>
          )}
        </View>

        {/* Actions button */}
        <TouchableOpacity
          {...uiProps(uiPath('fingo', 'component_row', 'action_btn', component.id))}
          style={styles.actionBtn}
          onPress={() => {
            logUI(uiPath('fingo', 'component_row', 'action_btn', component.id), 'press');
            onShowActions(component);
          }}
          onLongPress={() => {
            logUI(uiPath('fingo', 'component_row', 'action_long', component.id), 'long_press');
            onShowActions(component);
          }}
        >
          <Text style={styles.actionBtnText}>···</Text>
        </TouchableOpacity>
      </View>

      {/* Thin health bar at the bottom of the row */}
      {worst && (
        <View style={[styles.healthBar, { marginLeft: indent + 40 }]}>
          <View
            style={[
              styles.healthBarFill,
              {
                width: `${Math.min(100, (worst.totalSinceService / worst.interval.interval_value) * 100)}%`,
                backgroundColor: healthColor(
                  worst.isOverdue ? 0 : 1 - worst.totalSinceService / worst.interval.interval_value,
                ),
              },
            ]}
          />
        </View>
      )}

      {/* Children */}
      {expanded && children.length > 0 && (
        <View>
          {children.map((child) => (
            <ComponentRow
              key={child.component.id}
              node={child}
              depth={depth + 1}
              assetId={assetId}
              assetType={assetType}
              intervals={intervals}
              onShowActions={onShowActions}
              onAddChild={onAddChild}
            />
          ))}
        </View>
      )}

      {/* Add sub-component row (shown at the end of children when expanded) */}
      {expanded && (
        <TouchableOpacity
          {...uiProps(uiPath('fingo', 'component_row', 'add_sub', component.id))}
          style={[styles.addSubRow, { marginLeft: indent + 40 }]}
          onPress={() => {
            logUI(uiPath('fingo', 'component_row', 'add_sub', component.id), 'press');
            onAddChild(component.id);
          }}
        >
          <Text style={styles.addSubText}>+ Add sub-component</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 12,
    gap: 8,
  },
  expandBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIcon: {
    color: '#3B6A9E',
    fontSize: 12,
  },
  leafDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1F3A59',
  },
  content: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  categoryTag: {
    backgroundColor: '#0D2137',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1F3A59',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  categoryText: {
    color: '#3B6A9E',
    fontSize: 10,
    fontWeight: '600',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  healthText: {
    color: '#64748B',
    fontSize: 11,
  },
  overdueText: {
    color: '#f87171',
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionBtnText: {
    color: '#475569',
    fontSize: 18,
    letterSpacing: 1,
    lineHeight: 18,
  },
  healthBar: {
    height: 2,
    backgroundColor: '#0E1A2B',
    marginRight: 12,
    marginBottom: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  healthBarFill: {
    height: '100%',
    borderRadius: 1,
  },
  addSubRow: {
    paddingVertical: 7,
    paddingRight: 12,
  },
  addSubText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '500',
  },
});
