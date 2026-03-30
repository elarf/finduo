/**
 * Shared styles for Pool-related modals and forms.
 * Component-specific styles live in each component file.
 */
import { StyleSheet, Platform } from 'react-native';

export const poolSharedStyles = StyleSheet.create({
  // Screen shell
  container: {
    flex: 1,
    backgroundColor: '#060A14',
  },

  // Modal scaffold
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#0E1A2B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 20,
    width: '90%',
    maxWidth: 380,
  },
  modalTitle: {
    color: '#EAF3FF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
  },
  modalSecondaryText: {
    color: '#9BB0C9',
    fontSize: 14,
  },
  modalPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#53E3A6',
  },
  modalPrimaryText: {
    color: '#060A14',
    fontSize: 14,
    fontWeight: '600',
  },

  // Form elements
  input: {
    backgroundColor: '#060A14',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 10,
    color: '#EAF3FF',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  label: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  hintText: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 10,
  },

  // Screen header
  header: {
    paddingTop: Platform.OS === 'web' ? 14 : 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#000',
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    color: '#EAF3FF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  headerAction: {
    padding: 6,
  },
});
