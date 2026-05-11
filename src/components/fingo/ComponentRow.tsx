import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ComponentIcon from './ComponentIcon';
import type { AssetType, Component, ComponentNode, ComponentServiceInterval } from '../../types/fingo';
import {
  computeIntervalHealth, formatIntervalRemaining, healthColor,
} from '../../lib/fingo/health';
import { findTemplate } from '../../lib/fingo/componentTemplates';
import { getComponentIcon } from '../../lib/fingo/componentIcons';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

interface Props {
  node: ComponentNode;
  depth?: number;
  assetId: string;
  assetType: AssetType;
  intervals: Record<string, ComponentServiceInterval[]>;
  onShowActions: (component: Component) => void;
  onAddChild: (parentId: string) => void;
  onIntervalAction?: (action: 'edit' | 'delete', interval: ComponentServiceInterval, component: Component) => void;
}

export default function ComponentRow({
  node, depth = 0, assetId, assetType, intervals, onShowActions, onAddChild, onIntervalAction,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const { component, children } = node;
  const indent = depth * 16;

  const componentIntervals = intervals[component.id] ?? [];
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
            {...uiProps(uiPath('fingo', 'component_row', 'expand', component.id))}
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
            <ComponentIcon
              name={getComponentIcon(component.name, component.template_key)}
              size={14}
              color="#3B6A9E"
            />
            <Text style={styles.name} numberOfLines={1}>{component.name}</Text>
            {template && (
              <View style={styles.categoryTag}>
                <Text style={styles.categoryText}>{template.category}</Text>
              </View>
            )}
          </View>

          {/* All service interval badges */}
          {componentIntervals.length > 0 ? (
            <View style={styles.intervalList}>
              {componentIntervals.map((interval) => {
                const health = computeIntervalHealth(interval, component);
                const ratio = health.isOverdue ? 0 : 1 - health.totalSinceService / interval.interval_value;
                const color = healthColor(ratio);
                return (
                  <View key={interval.id}>
                    <View style={styles.intervalRow}>
                      <View style={[styles.healthDot, { backgroundColor: color }]} />
                      <TouchableOpacity
                        {...uiProps(uiPath('fingo', 'component_row', 'interval_edit', interval.id))}
                        style={styles.intervalLabel}
                        onPress={() => onIntervalAction?.('edit', interval, component)}
                      >
                        <Text style={styles.intervalName} numberOfLines={1}>
                          {interval.name}
                        </Text>
                        <Text style={[styles.intervalRemaining, health.isOverdue && styles.overdueText]}>
                          {health.isOverdue ? 'Overdue' : `${formatIntervalRemaining(health)} left`}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        {...uiProps(uiPath('fingo', 'component_row', 'interval_delete', interval.id))}
                        style={styles.intervalDeleteBtn}
                        onPress={() => onIntervalAction?.('delete', interval, component)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.intervalDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.healthBar}>
                      <View
                        style={[
                          styles.healthBarFill,
                          {
                            width: `${Math.min(100, (health.totalSinceService / interval.interval_value) * 100)}%`,
                            backgroundColor: color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
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
              onIntervalAction={onIntervalAction}
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
    alignItems: 'flex-start',
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
    marginTop: 2,
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
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  intervalList: {
    gap: 3,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  intervalLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  intervalName: {
    color: '#64748B',
    fontSize: 11,
    flexShrink: 1,
  },
  intervalRemaining: {
    color: '#64748B',
    fontSize: 11,
    flexShrink: 0,
  },
  overdueText: {
    color: '#f87171',
  },
  intervalDeleteBtn: {
    paddingLeft: 4,
  },
  intervalDeleteText: {
    color: '#334155',
    fontSize: 10,
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: -2,
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
    marginTop: 3,
    marginBottom: 3,
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
