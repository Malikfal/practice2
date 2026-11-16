import { StyleSheet } from 'react-native';

export const employeeDetailStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 20 },
  headerContainer: { alignItems: 'center', marginBottom: 30 },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', marginBottom: 15,
  },
  avatarText: { fontSize: 32, color: '#0055ff', fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 10 },
  roleBadge: { backgroundColor: '#e0f2fe', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleText: { color: '#0284c7', fontSize: 12, fontWeight: '600' },
  
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 15, marginTop: 10 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 20, elevation: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 15, fontWeight: '500', color: '#111', flex: 1, textAlign: 'right' },
  
  actionButton: { backgroundColor: '#0055ff', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  assignmentCard: {
    backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 4, borderLeftColor: '#0055ff'
  },
  assignmentInfo: { flex: 1 },
  assignmentTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  assignmentDates: { fontSize: 12, color: '#888' },
  assignmentRole: { 
    backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 
  },
  assignmentRoleText: { fontSize: 11, color: '#0284c7', fontWeight: 'bold' },

  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  daySummaryRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  daySummaryCard: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 12, alignItems: 'center', elevation: 2 },
  daySummaryLabel: { fontSize: 12, color: '#666', marginBottom: 5 },
  daySummaryValue: { fontSize: 18, fontWeight: 'bold', color: '#0055ff' },
  
  segmentCard: {
    backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#4caf50'
  },
  segmentTime: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  segmentInfo: { fontSize: 13, color: '#666' },
});