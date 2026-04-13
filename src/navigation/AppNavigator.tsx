import React from 'react'
import { Platform } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { RootTabParamList } from '../navigation'
import { Sidebar } from '../components/Sidebar'
import { HomeScreen } from '../screens/HomeScreen'
import { TransactionsScreen } from '../screens/TransactionsScreen'
import { ImportScreen } from '../screens/ImportScreen'
import { DigestScreen } from '../screens/DigestScreen'

const Tab = createBottomTabNavigator<RootTabParamList>()

export function AppNavigator() {
  if (Platform.OS === 'web') {
    return (
      <Tab.Navigator tabBar={(props) => <Sidebar {...props} />} screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
        <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transactions' }} />
        <Tab.Screen name="Import" component={ImportScreen} options={{ title: 'Import' }} />
        <Tab.Screen name="Digest" component={DigestScreen} options={{ title: 'Digest' }} />
      </Tab.Navigator>
    )
  }
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#6c63ff', tabBarInactiveTintColor: '#555', tabBarStyle: { backgroundColor: '#111', borderTopColor: '#222' } }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transactions' }} />
      <Tab.Screen name="Import" component={ImportScreen} options={{ title: 'Import' }} />
      <Tab.Screen name="Digest" component={DigestScreen} options={{ title: 'Digest' }} />
    </Tab.Navigator>
  )
}
