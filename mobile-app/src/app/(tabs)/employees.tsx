import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { employeeStyles as styles } from '@/styles/employeeStyles';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';

export default function EmployeesScreen() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      
      const data = response.data.data || response.data || [];
      setEmployees(data);
    } catch (error: any) {
      console.error('Ошибка загрузки сотрудников:', error.response?.data || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchEmployees();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEmployees();
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  // Проверка прав на создание
  const canCreate = hasPermission('employees.create_update');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Сотрудники</Text>
        {canCreate && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/create-employee')}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={employees}
        keyExtractor={(item: any) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.employeeCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.first_name ? item.first_name[0] : item.name?.[0] || 'U'}
              </Text>
            </View>
            <View style={styles.infoContainer}>
              <Text style={styles.nameText}>{item.first_name} {item.last_name}</Text>
              <Text style={styles.roleText}>
                {item.role_label || item.role || 'Сотрудник'} 
                {item.position ? ` • ${item.position}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>В компании пока нет сотрудников</Text>
          </View>
        }
      />
    </View>
  );
}