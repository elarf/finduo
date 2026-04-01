import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import Icon from '../Icon';
import { poolSharedStyles as sh } from './poolStyles';

interface Props {
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** Right-side actions — only shown when provided */
  onSettle?: () => void;
  onClose?: () => void;
  /** Simple icon-button action (e.g. "+" on the list view) */
  onAdd?: () => void;
  /** Creator-only: when provided shows an edit icon that reveals a delete button */
  onDelete?: () => void;
}

export function PoolHeader({ title, subtitle, onBack, onSettle, onClose, onAdd, onDelete }: Props) {
  const [editMode, setEditMode] = useState(false);

  return (
    <View style={sh.header} {...uiProps(uiPath('pool', 'header', 'container'))}>
      <TouchableOpacity
        onPress={() => {
          logUI(uiPath('pool', 'header', 'back_button'), 'press');
          onBack();
        }}
        style={sh.backButton}
        {...uiProps(uiPath('pool', 'header', 'back_button'))}
      >
        <Icon name="ArrowLeft" size={20} color="#EAF3FF" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={sh.headerTitle} {...uiProps(uiPath('pool', 'header', 'title'))}>{title}</Text>
        {subtitle ? (
          <Text style={sh.headerSub} {...uiProps(uiPath('pool', 'header', 'subtitle'))}>{subtitle}</Text>
        ) : null}
      </View>
      {!editMode && onSettle && (
        <TouchableOpacity
          onPress={() => {
            logUI(uiPath('pool', 'header', 'settle_button'), 'press');
            onSettle();
          }}
          style={sh.headerAction}
          {...uiProps(uiPath('pool', 'header', 'settle_button'))}
        >
          <Text style={{ color: '#53E3A6', fontSize: 13, fontWeight: '600' }}>Settle</Text>
        </TouchableOpacity>
      )}
      {!editMode && onClose && (
        <TouchableOpacity
          onPress={() => {
            logUI(uiPath('pool', 'header', 'close_button'), 'press');
            onClose();
          }}
          style={sh.headerAction}
          {...uiProps(uiPath('pool', 'header', 'close_button'))}
        >
          <Text style={{ color: '#f87171', fontSize: 13 }}>Close</Text>
        </TouchableOpacity>
      )}
      {editMode && onDelete && (
        <TouchableOpacity
          onPress={() => {
            logUI(uiPath('pool', 'header', 'delete_button'), 'press');
            setEditMode(false);
            onDelete();
          }}
          style={sh.headerAction}
          {...uiProps(uiPath('pool', 'header', 'delete_button'))}
        >
          <Icon name="Trash2" size={18} color="#f87171" />
        </TouchableOpacity>
      )}
      {onDelete && (
        <TouchableOpacity
          onPress={() => {
            const next = !editMode;
            logUI(uiPath('pool', 'header', 'edit_toggle'), next ? 'edit_on' : 'edit_off');
            setEditMode(next);
          }}
          style={sh.headerAction}
          {...uiProps(uiPath('pool', 'header', 'edit_toggle'))}
        >
          <Icon name={editMode ? 'X' : 'Pencil'} size={18} color={editMode ? '#94a3b8' : '#64748B'} />
        </TouchableOpacity>
      )}
      {onAdd && (
        <TouchableOpacity
          onPress={() => {
            logUI(uiPath('pool', 'header', 'add_button'), 'press');
            onAdd();
          }}
          style={sh.headerAction}
          {...uiProps(uiPath('pool', 'header', 'add_button'))}
        >
          <Icon name="Plus" size={20} color="#53E3A6" />
        </TouchableOpacity>
      )}
    </View>
  );
}
