import { doc, setDoc, onSnapshot, getDoc, getDocs, collection } from 'firebase/firestore';
import { appId } from '../firebase';

// --- Path Helpers ---
const settingsDoc = (db, uid, key) => doc(db, 'artifacts', appId, 'users', uid, 'settings', key);
const dailyPlanDoc = (db, uid, dateKey) => doc(db, 'artifacts', appId, 'users', uid, 'daily_plans', dateKey);

// --- Settings ---
export const subscribeSettings = (db, uid, key, callback) => {
    return onSnapshot(settingsDoc(db, uid, key), (snap) => {
        callback(snap.exists() ? snap.data() : null);
    });
};

export const saveSettings = async (db, uid, key, data) => {
    await setDoc(settingsDoc(db, uid, key), data, { merge: true });
};

// --- Daily Plans ---
export const subscribeDailyPlan = (db, uid, dateKey, callback) => {
    return onSnapshot(dailyPlanDoc(db, uid, dateKey), (snap) => {
        callback(snap.exists() ? snap.data().items || {} : {});
    });
};

export const saveDailyPlan = async (db, uid, dateKey, items) => {
    await setDoc(dailyPlanDoc(db, uid, dateKey), { items, updatedAt: new Date().toISOString() });
};

// --- Data Export ---
export const exportAllData = async (db, uid) => {
    const data = {};

    // Tasks
    const tasksSnap = await getDocs(collection(db, 'artifacts', appId, 'users', uid, 'tasks'));
    data.tasks = {};
    tasksSnap.forEach(d => { data.tasks[d.id] = d.data(); });

    // Lectures
    const lecturesSnap = await getDocs(collection(db, 'artifacts', appId, 'users', uid, 'lectures'));
    data.lectures = {};
    lecturesSnap.forEach(d => { data.lectures[d.id] = d.data(); });

    // Settings
    const settingsSnap = await getDocs(collection(db, 'artifacts', appId, 'users', uid, 'settings'));
    data.settings = {};
    settingsSnap.forEach(d => { data.settings[d.id] = d.data(); });

    // Achievements (last 30 days)
    const achievementsSnap = await getDocs(collection(db, 'artifacts', appId, 'users', uid, 'achievements'));
    data.achievements = {};
    achievementsSnap.forEach(d => { data.achievements[d.id] = d.data(); });

    // Daily Plans (last 7 days)
    const plansSnap = await getDocs(collection(db, 'artifacts', appId, 'users', uid, 'daily_plans'));
    data.daily_plans = {};
    plansSnap.forEach(d => { data.daily_plans[d.id] = d.data(); });

    return data;
};

export const importData = async (db, uid, data) => {
    let count = 0;

    // Import tasks
    if (data.tasks) {
        for (const [id, taskData] of Object.entries(data.tasks)) {
            await setDoc(doc(db, 'artifacts', appId, 'users', uid, 'tasks', id), taskData, { merge: true });
            count++;
        }
    }

    // Import lectures
    if (data.lectures) {
        for (const [id, lecData] of Object.entries(data.lectures)) {
            await setDoc(doc(db, 'artifacts', appId, 'users', uid, 'lectures', id), lecData, { merge: true });
            count++;
        }
    }

    // Import settings
    if (data.settings) {
        for (const [id, settData] of Object.entries(data.settings)) {
            await setDoc(doc(db, 'artifacts', appId, 'users', uid, 'settings', id), settData, { merge: true });
            count++;
        }
    }

    return count;
};
