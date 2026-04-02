import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from '../Icon';
import { styles } from '../../screens/DashboardScreen.styles';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

type IconPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  iconPickerAnim: Animated.Value;
  height: number;
  iconSearchQuery: string;
  setIconSearchQuery: (v: string) => void;
  filteredIconNames: string[];
  iconPickerTarget: 'category' | 'account' | 'tag' | null;
  categoryIcon: string | null;
  setCategoryIcon: (v: string | null) => void;
  newAccountIcon: string | null;
  setNewAccountIcon: (v: string | null) => void;
  tagIcon: string | null;
  setTagIcon: (v: string | null) => void;
};

const NUM_COLUMNS = 3;
const INITIAL_COUNT = 60;
const PAGE_SIZE = 60;

function IconPickerSheet({
  visible, onClose, iconPickerAnim, height,
  iconSearchQuery, setIconSearchQuery, filteredIconNames,
  iconPickerTarget, categoryIcon, setCategoryIcon,
  newAccountIcon, setNewAccountIcon, tagIcon, setTagIcon,
}: IconPickerSheetProps) {
  const flatListRef = useRef<FlatList>(null);
  const [displayCount, setDisplayCount] = useState(INITIAL_COUNT);

  // Reset count and scroll position when the picker opens
  useEffect(() => {
    if (visible) setDisplayCount(INITIAL_COUNT);
  }, [visible]);

  // Reset count and scroll position when query changes
  useEffect(() => {
    setDisplayCount(INITIAL_COUNT);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [iconSearchQuery]);

  const activeIcon = iconPickerTarget === 'category' ? categoryIcon
    : iconPickerTarget === 'account' ? newAccountIcon
    : tagIcon;

  // When searching, show all matches. When browsing, paginate.
  const isSearching = iconSearchQuery.trim().length > 0;
  const displayedIcons = isSearching
    ? filteredIconNames
    : filteredIconNames.slice(0, displayCount);

  const loadMore = () => {
    if (!isSearching) setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, filteredIconNames.length));
  };

  const renderIconItem = (iconName: string, styleOverride?: object) => {
    const isActive = activeIcon === iconName;
    return (
      <TouchableOpacity
        key={iconName}
        style={[styles.catPickerItem, isActive && styles.catPickerItemActive, styleOverride]}
        onPress={() => {
          logUI(uiPath('icon_picker', 'list', 'icon_cell', iconName), 'press');
          if (iconPickerTarget === 'category') setCategoryIcon(iconName);
          else if (iconPickerTarget === 'account') setNewAccountIcon(iconName);
          else if (iconPickerTarget === 'tag') setTagIcon(iconName);
          onClose();
        }}
        {...uiProps(uiPath('icon_picker', 'list', 'icon_cell', iconName))}
      >
        <Icon name={iconName} size={28} color="#8FA8C9" />
        <Text style={styles.catPickerItemSub}>{iconName}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
          {
            backgroundColor: '#060A14',
            zIndex: 300,
            transform: [
              {
                translateY: iconPickerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [height, 0],
                }),
              },
            ],
          },
        ]}
        {...uiProps(uiPath('icon_picker', 'sheet', 'sheet'))}
      >
        <View style={styles.catPickerHeader} {...uiProps(uiPath('icon_picker', 'sheet', 'backdrop'))}>
          <Text style={styles.catPickerTitle} {...uiProps(uiPath('icon_picker', 'sheet', 'title'))}>
            Choose Icon
          </Text>
          <TouchableOpacity
            onPress={() => { logUI(uiPath('icon_picker', 'header', 'close_button'), 'press'); onClose(); }}
            {...uiProps(uiPath('icon_picker', 'header', 'close_button'))}
          >
            <Icon name="close" size={24} color="#8FA8C9" />
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.iconSearchInput}
          placeholder="Search icons…"
          placeholderTextColor="#64748B"
          value={iconSearchQuery}
          onChangeText={setIconSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          {...uiProps(uiPath('icon_picker', 'form', 'search_input'))}
        />

        {Platform.OS === 'web' ? (
          <ScrollView
            contentContainerStyle={styles.catPickerGrid}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 300) {
                loadMore();
              }
            }}
            scrollEventThrottle={200}
          >
            {displayedIcons.map((name) => renderIconItem(name))}
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={displayedIcons}
            keyExtractor={(item) => item}
            numColumns={NUM_COLUMNS}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12 }}
            columnWrapperStyle={{ gap: 10, marginBottom: 10 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => renderIconItem(item, { flex: 1 })}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

export default React.memo(IconPickerSheet);
