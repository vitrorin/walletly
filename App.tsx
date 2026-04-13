import 'react-native-get-random-values';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@stripe/stripe-react-native';
import { RootStackParamList } from './src/navigation';
import { STRIPE_PUBLISHABLE_KEY } from './src/config';
import HomeScreen from './src/screens/HomeScreen';
import CreateBillScreen from './src/screens/CreateBillScreen';
import BillDetailScreen from './src/screens/BillDetailScreen';
import JoinBillScreen from './src/screens/JoinBillScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.billsplit">
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: { backgroundColor: '#f7f8fc' },
            headerTintColor: '#4f46e5',
            headerTitleStyle: { fontWeight: '700' },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'BillSplit' }} />
          <Stack.Screen name="CreateBill" component={CreateBillScreen} options={{ title: 'New Bill' }} />
          <Stack.Screen name="BillDetail" component={BillDetailScreen} options={{ title: 'Bill Details' }} />
          <Stack.Screen name="JoinBill" component={JoinBillScreen} options={{ title: 'Join a Bill' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </StripeProvider>
  );
}
