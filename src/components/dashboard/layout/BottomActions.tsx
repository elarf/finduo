import React from 'react';
import { Animated, Image, Text, TouchableOpacity, View } from 'react-native';
import { logUI, uiPath, uiProps } from '../../../lib/devtools';
import { useDashboard } from '../../../context/DashboardContext';
import Icon from '../../Icon';
import { styles } from '../../../screens/DashboardScreen.styles';

export default function BottomActions() {
  const {
    showAccountOverviewPicker,
    selectedCategoryFilter, setSelectedCategoryFilter,
    selectedTagFilter, setSelectedTagFilter,
    showOnlyTransfers, setShowOnlyTransfers,
    filterBarAnim,
    filterIsExpense,
    openEntryModal,
    openTransfer,
    desktopView,
  } = useDashboard();

  if (showAccountOverviewPicker) return null;

  return (
    <View
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
      {...uiProps(uiPath('dashboard', 'bottom_actions', 'container'))}
    >
      {/* Filter notification bar */}
      <Animated.View style={{
        height: filterBarAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 36] }),
        overflow: 'hidden',
        backgroundColor: '#0D2137',
        borderTopWidth: 1,
        borderTopColor: '#1B3553',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
      }}>
        <Text
          style={{ color: '#8FA8C9', fontSize: 12, flex: 1 }}
          numberOfLines={1}
          {...uiProps(uiPath('dashboard', 'filter_bar', 'label'))}
        >
          {[
            selectedCategoryFilter && 'category',
            selectedTagFilter && 'tag',
            showOnlyTransfers && 'transfers',
          ].filter(Boolean).join(' + ')} filter active
        </Text>
        <TouchableOpacity
          onPress={() => {
            logUI(uiPath('dashboard', 'filter_bar', 'clear_button'), 'press');
            setSelectedCategoryFilter(null);
            setSelectedTagFilter(null);
            setShowOnlyTransfers(false);
          }}
          {...uiProps(uiPath('dashboard', 'filter_bar', 'clear_button'))}
        >
          <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '600' }}>✕ Clear all</Text>
        </TouchableOpacity>
      </Animated.View>
      <View style={[styles.bottomBar, !desktopView && { gap: 0 }, { position: 'relative' }]} {...uiProps(uiPath('dashboard', 'bottom_actions', 'bar'))}>
        <TouchableOpacity
          style={[
            styles.bottomBarIncome,
            !desktopView && styles.bottomBarMobile,
            filterIsExpense && styles.bottomBarDisabled
          ]}
          onPress={() => {
            if (!filterIsExpense) {
              logUI(uiPath('dashboard', 'bottom_actions', 'income_button'), 'press');
              openEntryModal('income', null);
            }
          }}
          accessibilityLabel="Add income"
          {...uiProps(uiPath('dashboard', 'bottom_actions', 'income_button'))}
        >
          {!desktopView ? (
            <Image
              source={require('../../../../assets/addincome.png')}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          ) : (
            <Icon name="add" size={28} color="#EAF2FF" />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.bottomBarTransfer,
            !desktopView && styles.bottomBarMobile,
            filterIsExpense && styles.bottomBarDisabled
          ]}
          onPress={() => {
            if (!filterIsExpense) {
              logUI(uiPath('dashboard', 'bottom_actions', 'transfer_button'), 'press');
              openTransfer();
            }
          }}
          accessibilityLabel="Transfer between accounts"
          {...uiProps(uiPath('dashboard', 'bottom_actions', 'transfer_button'))}
        >
          {!desktopView ? (
            <Image
              source={require('../../../../assets/addtransfer.png')}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          ) : (
            <Icon name={"swap_horiz" as any} size={28} color="#EAF2FF" />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.bottomBarExpense,
            !desktopView && styles.bottomBarMobile,
          ]}
          onPress={() => {
            logUI(uiPath('dashboard', 'bottom_actions', 'expense_button'), 'press');
            openEntryModal('expense', filterIsExpense ? selectedCategoryFilter : null);
          }}
          accessibilityLabel="Add expense"
          {...uiProps(uiPath('dashboard', 'bottom_actions', 'expense_button'))}
        >
          {!desktopView ? (
            <Image
              source={require('../../../../assets/addexpensee.png')}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          ) : (
            <Icon name="remove" size={28} color="#EAF2FF" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
