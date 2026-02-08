import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCTaaYioZuXIIbs3G1RCfe9E5neCAtrRYY",
    authDomain: "organizatio-79680.firebaseapp.com",
    projectId: "organizatio-79680",
    storageBucket: "organizatio-79680.firebasestorage.app",
    messagingSenderId: "168221682458",
    appId: "1:168221682458:web:d394d960fd25289906daa3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = 'meditrack-v1';
export default app;
