import { StyleSheet } from 'react-native';

export const createEmployeeStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  scrollContent: { padding: 20, paddingTop: 40, paddingBottom: 60 }, // <-- Добавили paddingBottom
  title: { fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 20 },
  label: { fontSize: 14, color: '#333', marginBottom: 8, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16, backgroundColor: '#fff' },
  button: { backgroundColor: '#0055ff', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});