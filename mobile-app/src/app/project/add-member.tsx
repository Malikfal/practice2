import api from '@/services/api';
import { addMemberStyles as styles } from '@/styles/addMemberStyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';

export default function AddMemberScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();

  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [projectMembers, setProjectMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
        const [employeesRes, projectRes] = await Promise.all([
        api.get('/employees'),
        api.get(`/projects/${projectId}`)
      ]);

      const empData = employeesRes.data.data || employeesRes.data || [];
      setAllEmployees(empData);

      const projData = projectRes.data.project || projectRes.data.data || projectRes.data;
      const memberIds = (projData.members || []).map((m: any) => m.id);
      setProjectMembers(memberIds);

    } catch (error: any) {
      console.error('Ошибка загрузки для добавления:', error.response?.data || error.message);
      Alert.alert('Ошибка', 'Не удалось загрузить список сотрудников');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchData();
  }, [projectId]);

  const handleAddMember = async (userId: string) => {
    setAddingId(userId);
    try {
      await api.post(`/projects/${projectId}/members`, { 
        user_id: userId 
      });
      
      Alert.alert('Успех', 'Сотрудник добавлен в проект');
      
      setProjectMembers(prev => [...prev, userId]);
      
    } catch (error: any) {
      console.error('Ошибка добавления:', error.response?.data);
      Alert.alert('Ошибка', error.response?.data?.message || 'Не удалось добавить сотрудника');
    } finally {
      setAddingId(null);
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Выберите сотрудника</Text>
      
      <FlatList
        data={allEmployees}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={({ item }) => {
          const isAlreadyMember = projectMembers.includes(item.id);
          const isAdding = addingId === item.id;

          return (
            <View style={styles.employeeCard}>
              <View style={styles.employeeInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.first_name ? item.first_name[0] : item.name?.[0] || 'U'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.nameText}>{item.first_name} {item.last_name}</Text>
                  <Text style={styles.roleText}>{item.role_label || item.role}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[
                  styles.addButton, 
                  isAlreadyMember && { backgroundColor: '#ccc' } // Серый цвет, если уже добавлен
                ]}
                disabled={isAlreadyMember || isAdding}
                onPress={() => handleAddMember(item.id)}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.addButtonText}>
                    {isAlreadyMember ? 'В проекте' : 'Добавить'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>В компании нет доступных сотрудников</Text>
        }
      />
    </View>
  );
}