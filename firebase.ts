import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyAH7m3E41OlYl_rCzMUfvMVpAzLHQF1yag',
  authDomain: 'billsplit-53f84.firebaseapp.com',
  projectId: 'billsplit-53f84',
  storageBucket: 'billsplit-53f84.firebasestorage.app',
  messagingSenderId: '832801330835',
  appId: '1:832801330835:web:1cf432d97c6b542e48df66',
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
