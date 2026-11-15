import { StyleSheet } from 'react-native';

export const addMemberStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 20, marginTop: 10 },
  employeeCard: { 
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10, 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
  },
  employeeInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 18, color: '#0055ff', fontWeight: 'bold' },
  nameText: { fontSize: 16, fontWeight: '600', color: '#333' },
  roleText: { fontSize: 13, color: '#666', marginTop: 4 },
  addButton: { backgroundColor: '#0055ff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 30, fontSize: 16 }
});