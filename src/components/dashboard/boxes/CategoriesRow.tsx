import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDashboard } from '../../../context/DashboardContext';
import Icon from '../../Icon';
import { styles } from '../../../screens/DashboardScreen.styles';
import { uiPath, uiProps, logUI } from '../../../lib/devtools';

export default function CategoriesRow() {
  const navigation = useNavigation<any>();
  const {
    showAccountOverviewPicker,
    desktopView,
    categoriesCollapsed, setCategoriesCollapsed,
    sortedSelectedCategories,
    setCategoryName, setCategoryType, setCategoryColor, setCategoryIcon, setCategoryTagIds,
    openEntryModal,
  } = useDashboard();

  if (showAccountOverviewPicker) return null;

  return (
    <>
      <View {...uiProps(uiPath('dashboard', 'categories_row', 'container'))} style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>Categories</Text>
          {desktopView && (
            <TouchableOpacity
              {...uiProps(uiPath('dashboard', 'categories_row', 'collapse_btn'))}
              onPress={() => setCategoriesCollapsed((p) => !p)}
              style={styles.collapseTrigger}
            >
              <Text style={styles.collapseChevron}>{categoriesCollapsed ? '▸' : '▾'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {(!desktopView || !categoriesCollapsed) && (
        <View {...uiProps(uiPath('dashboard', 'categories_row', 'chips_wrap'))} style={styles.chipsWrap}>
          {sortedSelectedCategories.map((c) => (
            <TouchableOpacity
              key={c.id}
              {...uiProps(uiPath('dashboard', 'categories_row', 'category_chip', c.id))}
              style={[styles.categoryChip, c.color ? { borderColor: c.color } : undefined]}
              onPress={() => {
                logUI(uiPath('dashboard', 'categories_row', 'category_chip', c.id), 'press');
                openEntryModal(c.type, c.id);
              }}
              onLongPress={() => {
                logUI(uiPath('dashboard', 'categories_row', 'category_chip', c.id), 'long_press');
                // Initialize form state before navigating
                setCategoryName(c.name);
                setCategoryType(c.type);
                setCategoryColor(c.color ?? null);
                setCategoryIcon(c.icon ?? null);
                setCategoryTagIds((c.tag_ids ?? []) as string[]);
                navigation.navigate('Category', { categoryId: c.id });
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
