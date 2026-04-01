import React from 'react';
import { Animated, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../Icon';
import { styles } from '../../screens/DashboardScreen.styles';
import { AppAccount } from '../../types/dashboard';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

type AccountPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  acctPickerAnim: Animated.Value;
  height: number;
  accounts: AppAccount[];
  acctPickerSheetTarget: 'entry' | 'invite' | 'transfer-from' | 'transfer-to' | null;
  entryAccountId: string | null;
  setEntryAccountId: (id: string) => void;
  invitationAccountId: string | null;
  setInvitationAccountId: (id: string) => void;
  loadManagedInvites: (accountId: string) => void;
  transferFromId: string | null;
  setTransferFromId: (id: string) => void;
  transferToId: string | null;
  setTransferToId: (id: string) => void;
};

function AccountPickerSheet({
  visible, onClose, acctPickerAnim, height,
  accounts, acctPickerSheetTarget,
  entryAccountId, setEntryAccountId,
  invitationAccountId, setInvitationAccountId,
  loadManagedInvites,
  transferFromId, setTransferFromId,
  transferToId, setTransferToId,
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
        {...uiProps(uiPath('account_picker', 'sheet', 'sheet'))}
      >
        <View style={styles.catPickerHeader} {...uiProps(uiPath('account_picker', 'sheet', 'backdrop'))}>
          <Text style={styles.catPickerTitle} {...uiProps(uiPath('account_picker', 'sheet', 'title'))}>
            {acctPickerSheetTarget === 'transfer-from' ? 'From Account' : acctPickerSheetTarget === 'transfer-to' ? 'To Account' : 'Choose Account'}
          </Text>
          <TouchableOpacity
            onPress={() => { logUI(uiPath('account_picker', 'header', 'close_button'), 'press'); onClose(); }}
            {...uiProps(uiPath('account_picker', 'header', 'close_button'))}
          >
            <Icon name="close" size={24} color="#8FA8C9" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.catPickerGrid} showsVerticalScrollIndicator={false}>
          {accounts.map((a) => {
            const isActive =
              (acctPickerSheetTarget === 'entry' && entryAccountId === a.id) ||
              (acctPickerSheetTarget === 'invite' && invitationAccountId === a.id) ||
              (acctPickerSheetTarget === 'transfer-from' && transferFromId === a.id) ||
              (acctPickerSheetTarget === 'transfer-to' && transferToId === a.id);
            return (
            <TouchableOpacity
              key={a.id}
              style={[
                styles.catPickerItem,
                isActive && styles.catPickerItemActive,
              ]}
              onPress={() => {
                logUI(uiPath('account_picker', 'list', 'account_row', a.id), 'press');
                if (acctPickerSheetTarget === 'entry') {
                  setEntryAccountId(a.id);
                } else if (acctPickerSheetTarget === 'invite') {
                  setInvitationAccountId(a.id);
                  void loadManagedInvites(a.id);
                } else if (acctPickerSheetTarget === 'transfer-from') {
                  setTransferFromId(a.id);
                } else if (acctPickerSheetTarget === 'transfer-to') {
                  setTransferToId(a.id);
                }
                onClose();
              }}
              {...uiProps(uiPath('account_picker', 'list', 'account_row', a.id))}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
                {...uiProps(uiPath('account_picker', 'list', 'account_icon', a.id))}
              >
                {a.icon && <Icon name={a.icon} size={20} color="#8FA8C9" />}
                <Text style={styles.catPickerItemText} {...uiProps(uiPath('account_picker', 'list', 'account_name', a.id))}>
                  {a.name}
                </Text>
              </View>
              <Text style={styles.catPickerItemSub}>{a.currency}</Text>
            </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

export default React.memo(AccountPickerSheet);
