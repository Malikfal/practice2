import { StyleSheet } from 'react-native';

export const projectsStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 50, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  addButton: { backgroundColor: '#0055ff', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  card: { 
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
    elevation: 2
  },
  iconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  textContainer: { flex: 1 },
  projectName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  projectStatus: { fontSize: 13, color: '#666' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { marginTop: 10, fontSize: 16, color: '#999' }
});