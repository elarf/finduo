import React from 'react';
import { Animated, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../Icon';
import { styles } from '../../screens/DashboardScreen.styles';
import { AppAccount } from '../../types/dashboard';

type AccountPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  acctPickerAnim: Animated.Value;
  height: number;
  accounts: AppAccount[];
  acctPickerSheetTarget: 'entry' | 'invite' | null;
  entryAccountId: string | null;
  setEntryAccountId: (id: string) => void;
  invitationAccountId: string | null;
  setInvitationAccountId: (id: string) => void;
  loadManagedInvites: (accountId: string) => void;
};

function AccountPickerSheet({
  visible, onClose, acctPickerAnim, height,
  accounts, acctPickerSheetTarget,
  entryAccountId, setEntryAccountId,
  invitationAccountId, setInvitationAccountId,
  loadManagedInvites,
}: AccountPickerSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
          {
            backgroundColor: '#060A14',
            zIndex: 200,
            transform: [
              {
                translateY: acctPickerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [height, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.catPickerHeader}>
          <Text style={styles.catPickerTitle}>Choose Account</Text>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color="#8FA8C9" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.catPickerGrid} showsVerticalScrollIndicator={false}>
          {accounts.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={[
                styles.catPickerItem,
                ((acctPickerSheetTarget === 'entry' && entryAccountId === a.id) ||
                 (acctPickerSheetTarget === 'invite' && invitationAccountId === a.id)) && styles.catPickerItemActive,
              ]}
              onPress={() => {
                if (acctPickerSheetTarget === 'entry') {
                  setEntryAccountId(a.id);
                } else if (acctPickerSheetTarget === 'invite') {
                  setInvitationAccountId(a.id);
                  void loadManagedInvites(a.id);
                }
                onClose();
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                {a.icon && <Icon name={a.icon} size={20} color="#8FA8C9" />}
                <Text style={styles.catPickerItemText}>{a.name}</Text>
              </View>
              <Text style={styles.catPickerItemSub}>{a.currency}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

export default React.memo(AccountPickerSheet);
