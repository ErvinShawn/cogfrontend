import { StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

export default StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    backgroundColor: Colors.background || '#F8FAFC',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoPlaceholder: {
    width: 64,
    height: 64,
    backgroundColor: Colors.primaryLight || '#D1FAE5',
    borderRadius: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.text || '#0F172A',
    fontFamily: 'Inter',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.muted || '#64748B',
    fontFamily: 'Inter',
    marginBottom: 32,
  },
  formContainer: {
    marginBottom: 16,
    gap: 16, 
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  linkContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  link: {
    color: Colors.muted || '#64748B',
    fontSize: 15,
    fontFamily: 'Inter',
  },
  linkBold: {
    color: Colors.primary || '#10B981',
    fontWeight: '700',
    fontFamily: 'Inter',
  },
});