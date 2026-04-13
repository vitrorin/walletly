import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Bill } from '../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export default function HomeScreen({ navigation }: Props) {
  const [bills, setBills] = useState<Bill[]>([]);

  useEffect(() => {
    loadBills();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadBills);
    return unsubscribe;
  }, [navigation]);

  async function loadBills() {
    try {
      const idsStored = await AsyncStorage.getItem('billIds');
      if (!idsStored) return;
      const ids: string[] = JSON.parse(idsStored);

      const promises = ids.map(
        (id) =>
          new Promise<Bill | null>((resolve) => {
            const unsub = onSnapshot(doc(db, 'bills', id), (snap) => {
              unsub();
              if (snap.exists()) {
                resolve({ id: snap.id, ...(snap.data() as Omit<Bill, 'id'>) });
              } else {
                resolve(null);
              }
            });
          })
      );

      const results = await Promise.all(promises);
      setBills(results.filter(Boolean) as Bill[]);
    } catch (e) {
      console.error(e);
    }
  }

  function paidCount(bill: Bill) {
    return bill.participants.filter((p) => p.paid).length;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Bills</Text>

      {bills.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No bills yet.</Text>
          <Text style={styles.emptySubText}>Create one or join a friend's bill.</Text>
        </View>
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('BillDetail', { billId: item.id })}
            >
              <View>
                <Text style={styles.billTitle}>{item.title}</Text>
                <Text style={styles.billCode}>Code: {item.code}</Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.amount}>${item.totalAmount.toFixed(2)}</Text>
                <Text style={styles.paidStatus}>
                  {paidCount(item)}/{item.participants.length} paid
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate('JoinBill')}
        >
          <Text style={styles.secondaryButtonText}>Join a Bill</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('CreateBill')}
        >
          <Text style={styles.buttonText}>+ New Bill</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fc', padding: 20 },
  header: { fontSize: 28, fontWeight: '700', marginTop: 10, marginBottom: 20, color: '#1a1a2e' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, color: '#666', fontWeight: '600' },
  emptySubText: { fontSize: 14, color: '#aaa', marginTop: 6 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  billTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  billCode: { fontSize: 12, color: '#888', marginTop: 3 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: '700', color: '#4f46e5' },
  paidStatus: { fontSize: 12, color: '#888', marginTop: 3 },
  buttonRow: { flexDirection: 'row', gap: 10, paddingBottom: 10 },
  button: {
    flex: 1,
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButton: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#4f46e5' },
  secondaryButtonText: { color: '#4f46e5', fontWeight: '700', fontSize: 15 },
});
