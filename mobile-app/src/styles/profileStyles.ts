import { StyleSheet } from 'react-native';

export const profileStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 40 },
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
  label: { fontSize: 14, color: '#333', marginBottom: 8, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16, backgroundColor: '#fafafa' },
  readOnlyInput: { backgroundColor: '#f0f0f0', color: '#888' }, // Для email
  
  button: { backgroundColor: '#0055ff', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  logoutButton: { backgroundColor: '#ff4444', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  logoutButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});