import { StyleSheet } from 'react-native';

export const IndexStyles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 20 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 40, 
    marginBottom: 20 
  },
  greeting: { fontSize: 16, color: '#666' },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  avatar: { 
    width: 50, height: 50, 
    borderRadius: 25, 
    backgroundColor: '#e0e7ff', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  card: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 12, 
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3
  },
  cardTitle: { fontSize: 14, color: '#666', marginBottom: 5 },
  cardValue: { fontSize: 18, fontWeight: '600', color: '#0055ff' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#111' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  smallCard: { 
    backgroundColor: '#fff', 
    width: '48%', 
    padding: 15, 
    borderRadius: 12, 
    alignItems: 'center',
    elevation: 3
  },
  smallCardText: { marginTop: 10, fontSize: 14, fontWeight: '500', textAlign: 'center' }
});