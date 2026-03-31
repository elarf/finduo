import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import Icon from '../../Icon';
import { styles } from '../../../screens/DashboardScreen.styles';

export default function CategoriesRow() {
  const {
    showAccountOverviewPicker,
    desktopView,
    categoriesCollapsed, setCategoriesCollapsed,
    sortedSelectedCategories,
    setEditingCategoryId,
    setCategoryName, setCategoryType, setCategoryColor, setCategoryIcon, setCategoryTagIds,
    setShowCategoryModal,
    openEntryModal,
  } = useDashboard();

  if (showAccountOverviewPicker) return null;

  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>Categories</Text>
          {desktopView && (
            <TouchableOpacity onPress={() => setCategoriesCollapsed((p) => !p)} style={styles.collapseTrigger}>
              <Text style={styles.collapseChevron}>{categoriesCollapsed ? '▸' : '▾'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {(!desktopView || !categoriesCollapsed) && (
        <View style={styles.chipsWrap}>
          {sortedSelectedCategories.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.categoryChip, c.color ? { borderColor: c.color } : undefined]}
              onPress={() => openEntryModal(c.type, c.id)}
              onLongPress={() => {
                setEditingCategoryId(c.id);
                setCategoryName(c.name);
                setCategoryType(c.type);
                setCategoryColor(c.color ?? null);
                setCategoryIcon(c.icon ?? null);
                setCategoryTagIds((c.tag_ids ?? []) as string[]);
                setShowCategoryModal(true);
              }}
            >
              <View style={styles.categoryChipInner}>
                {c.icon ? (
                  <Icon
                    name={c.icon as any}
                    size={14}
                    color={c.color ?? (c.type === 'income' ? '#6ED8A5' : '#FCA5A5')}
                    style={{ marginRight: 4 }}
                  />
                ) : null}
                <Text style={styles.categoryChipText}>{c.name}</Text>
              </View>
              <Text style={[styles.categoryChipType, c.type === 'income' && styles.incomeType]}>{c.type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
}
