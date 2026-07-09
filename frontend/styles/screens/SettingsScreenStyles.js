import { StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background || '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingTop: 60, // Gives breathing room at the top
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted || '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 8,
    fontFamily: 'Inter',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden', // Keeps the pressed state inside the rounded corners
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  rowPressed: {
    backgroundColor: '#F8FAFC', // Soft highlight when tapped
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight || '#D1FAE5', // Soft green background
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconBoxDestructive: {
    backgroundColor: '#FEF2F2', // Soft red for sign out
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text || '#1E293B',
    fontFamily: 'Inter',
  },
  destructiveText: {
    color: '#EF4444', // Red text for sign out
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 66, // Aligns exactly with the text, skipping the icon!
  },
  versionText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 40,
    marginBottom: 20,
    fontFamily: 'Inter',
  },
  
});