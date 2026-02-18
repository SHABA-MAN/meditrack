import {
    collection, doc, setDoc, deleteDoc, updateDoc,
    onSnapshot, query, orderBy
} from 'firebase/firestore';
import { appId } from '../firebase';

// --- Path Helpers ---
const tasksCol = (db, uid) => collection(db, 'artifacts', appId, 'users', uid, 'tasks');
const taskDoc = (db, uid, taskId) => doc(db, 'artifacts', appId, 'users', uid, 'tasks', taskId);

// --- Listeners ---
export const subscribeTasks = (db, uid, callback, validStages = null) => {
    const q = query(tasksCol(db, uid), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
        const list = [];
        snap.forEach(d => {
            const data = d.data();
            if (!validStages || validStages.includes(data.stage)) {
                list.push({ id: d.id, ...data });
            }
        });
        callback(list);
    });
};

// --- CRUD ---
export const createTask = async (db, uid, taskId, data) => {
    await setDoc(taskDoc(db, uid, taskId), {
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
};

export const updateTask = async (db, uid, taskId, updates) => {
    await updateDoc(taskDoc(db, uid, taskId), {
        ...updates,
        updatedAt: new Date().toISOString()
    });
};

export const deleteTask = async (db, uid, taskId) => {
    await deleteDoc(taskDoc(db, uid, taskId));
};

export const moveTaskToStage = async (db, uid, taskId, stage) => {
    await updateDoc(taskDoc(db, uid, taskId), {
        stage,
        updatedAt: new Date().toISOString()
    });
};

export const mergeTaskIntoGroup = async (db, uid, targetTask, draggedTask, expandedGroups, setExpandedGroups) => {
    const newSubTasks = targetTask.isGroup
        ? [...(targetTask.subTasks || [])]
        : [];

    const newSubTask = {
        id: draggedTask.id,
        title: draggedTask.title,
        completed: false
    };

    if (!newSubTasks.find(st => st.id === draggedTask.id)) {
        newSubTasks.push(newSubTask);

        await updateDoc(taskDoc(db, uid, targetTask.id), {
            isGroup: true,
            subTasks: newSubTasks,
            updatedAt: new Date().toISOString()
        });

        await updateDoc(taskDoc(db, uid, draggedTask.id), {
            parentGroupId: targetTask.id,
            stage: targetTask.stage,
            updatedAt: new Date().toISOString()
        });

        setExpandedGroups(new Set([...expandedGroups, targetTask.id]));
        return true;
    }
    return false;
};

// --- Session Management ---
const sessionDoc = (db, uid, type) => doc(db, 'artifacts', appId, 'users', uid, 'active_session', type);

export const saveSession = async (db, uid, type, isFree, queue) => {
    try {
        await setDoc(sessionDoc(db, uid, type), {
            type,
            startTime: new Date().toISOString(),
            isFree,
            queue: queue || []
        });
    } catch (e) {
        console.error('Failed to save session', e);
    }
};

export const deleteSession = async (db, uid, type) => {
    try {
        await deleteDoc(sessionDoc(db, uid, type));
    } catch (e) {
        console.error('Failed to delete session', e);
    }
};

export const subscribeSession = (db, uid, type, callback) => {
    return onSnapshot(sessionDoc(db, uid, type), callback, (error) => {
        console.error('Session sync error:', error);
    });
};
