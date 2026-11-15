import { StyleSheet } from 'react-native';

export const taskStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#111', marginBottom: 20, marginTop: 10 },
  taskCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  taskDesc: { fontSize: 13, color: '#888' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { marginTop: 10, fontSize: 16, color: '#999' },

  membersContainer: { marginBottom: 20 },
  membersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  membersTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  addMemberButton: { padding: 5, backgroundColor: '#e0e7ff', borderRadius: 5 },
  membersList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  memberAvatar: { 
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#0055ff', 
    justifyContent: 'center', alignItems: 'center' 
  },
  memberText: { color: '#fff', fontWeight: 'bold' },
  noMembersText: { fontSize: 14, color: '#888', fontStyle: 'italic' }
});