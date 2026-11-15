import { StyleSheet } from 'react-native';

export const homeStyles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 16 },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    marginTop: 50, marginBottom: 20 
  },
  greeting: { fontSize: 16, color: '#666' },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  avatar: { 
    width: 50, height: 50, borderRadius: 25, 
    backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' 
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, marginTop: 10, color: '#111' },
  
  // Стили для сводки
  summaryContainer: { 
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 
  },
  summaryCard: { 
    flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 12, marginHorizontal: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3
  },
  summaryLabel: { fontSize: 12, color: '#666', marginBottom: 5, textTransform: 'uppercase' },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: '#0055ff' },

  // Стили для сегментов
  segmentCard: {
    backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#4caf50'
  },
  segmentTime: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  segmentInfo: { fontSize: 13, color: '#666' },
  
  // Стили для задач
  taskCard: { 
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, 
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
  },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  projectName: { fontSize: 12, color: '#888' },
  
  emptyContainer: { alignItems: 'center', marginTop: 30, marginBottom: 30 },
  emptyText: { marginTop: 10, fontSize: 14, color: '#999' }
});