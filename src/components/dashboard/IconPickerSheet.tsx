import React from 'react';
import { Animated, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from '../Icon';
import { styles } from '../../screens/DashboardScreen.styles';

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

function IconPickerSheet({
  visible, onClose, iconPickerAnim, height,
  iconSearchQuery, setIconSearchQuery, filteredIconNames,
  iconPickerTarget, categoryIcon, setCategoryIcon,
  newAccountIcon, setNewAccountIcon, tagIcon, setTagIcon,
}: IconPickerSheetProps) {
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
      >
        <View style={styles.catPickerHeader}>
          <Text style={styles.catPickerTitle}>Choose Icon</Text>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color="#8FA8C9" />
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.iconSearchInput}
          placeholder="Search icons..."
          placeholderTextColor="#64748B"
          value={iconSearchQuery}
          onChangeText={setIconSearchQuery}
        />
        <ScrollView contentContainerStyle={styles.catPickerGrid} showsVerticalScrollIndicator={false}>
          {filteredIconNames.map((iconName) => {
            const isActive = iconPickerTarget === 'category' ? categoryIcon === iconName
              : iconPickerTarget === 'account' ? newAccountIcon === iconName
              : tagIcon === iconName;
            return (
              <TouchableOpacity
                key={iconName}
                style={[styles.catPickerItem, isActive && styles.catPickerItemActive]}
                onPress={() => {
                  if (iconPickerTarget === 'category') setCategoryIcon(iconName);
                  else if (iconPickerTarget === 'account') setNewAccountIcon(iconName);
                  else if (iconPickerTarget === 'tag') setTagIcon(iconName);
                  onClose();
                }}
              >
                <Icon name={iconName} size={28} color="#8FA8C9" />
                <Text style={styles.catPickerItemSub}>{iconName}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

export default React.memo(IconPickerSheet);
