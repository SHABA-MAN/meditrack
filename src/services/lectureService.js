import {
    collection, doc, setDoc, deleteDoc, updateDoc,
    onSnapshot, query, orderBy, writeBatch, addDoc
} from 'firebase/firestore';
import { appId } from '../firebase';

export const INTERVALS = [1, 2, 4, 7];

// --- Path Helpers ---
const lecturesCol = (db, uid) => collection(db, 'artifacts', appId, 'users', uid, 'lectures');
const lectureDoc = (db, uid, lectureId) => doc(db, 'artifacts', appId, 'users', uid, 'lectures', lectureId);
const historyCol = (db, uid) => collection(db, 'artifacts', appId, 'users', uid, 'history');

// --- Listeners ---
export const subscribeLectures = (db, uid, callback) => {
    return onSnapshot(lecturesCol(db, uid), (snap) => {
        const map = {};
        snap.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
        callback(map);
    });
};

// --- CRUD ---
export const saveLecture = async (db, uid, lectureId, data) => {
    await setDoc(lectureDoc(db, uid, lectureId), data, { merge: true });
};

export const deleteLecture = async (db, uid, lectureId) => {
    await deleteDoc(lectureDoc(db, uid, lectureId));
};

// --- Stage Progression ---
export const completeLecture = async (db, uid, lecture) => {
    const currentStage = lecture.stage || 0;
    const nextStage = currentStage + 1;
    const today = new Date();
    let nextDate = new Date();
    let isCompleted = false;
    let nextReviewVal = '';

    if (nextStage > INTERVALS.length) {
        isCompleted = true;
        nextReviewVal = 'COMPLETED';
    } else {
        const interval = INTERVALS[nextStage - 1] || 7;
        nextDate.setDate(nextDate.getDate() + interval);
        nextReviewVal = nextDate.toISOString();
    }

    const data = {
        id: lecture.id,
        subject: lecture.subject,
        number: lecture.number,
        stage: nextStage,
        lastStudied: today.toISOString(),
        nextReview: nextReviewVal,
        isCompleted
    };

    await setDoc(lectureDoc(db, uid, lecture.id), data, { merge: true });

    // Log to history
    await addDoc(historyCol(db, uid), {
        taskId: lecture.id,
        subject: lecture.subject,
        number: lecture.number,
        title: lecture.title || '',
        completedAt: today.toISOString(),
        stageCompleted: currentStage
    });

    return { nextStage, isCompleted };
};

export const manualStageUpdate = async (db, uid, subject, number, newStage) => {
    const lectureId = `${subject}_${number}`;
    const today = new Date();
    let nextDate = new Date();
    let isCompleted = false;
    let nextReviewVal = '';

    if (newStage === 0) {
        await setDoc(lectureDoc(db, uid, lectureId), {
            stage: 0, lastStudied: null, nextReview: '', isCompleted: false
        }, { merge: true });
        return;
    }

    if (newStage > INTERVALS.length) {
        isCompleted = true;
        nextReviewVal = 'COMPLETED';
    } else {
        const interval = INTERVALS[newStage - 1] || 7;
        nextDate.setDate(nextDate.getDate() + interval);
        nextReviewVal = nextDate.toISOString();
    }

    const data = {
        id: lectureId, subject, number,
        stage: newStage,
        lastStudied: today.toISOString(),
        nextReview: nextReviewVal,
        isCompleted
    };
    await setDoc(lectureDoc(db, uid, lectureId), data, { merge: true });
};

export const resetSubjectProgress = async (db, uid, lectures, subjCode) => {
    const batch = writeBatch(db);
    let count = 0;
    Object.values(lectures).forEach(l => {
        if (l.subject === subjCode) {
            batch.delete(lectureDoc(db, uid, l.id));
            count++;
        }
    });
    if (count > 0) await batch.commit();
    return count;
};

export const createDefaultLecture = async (db, uid, subject, number) => {
    const lectureId = `${subject}_${number}`;
    await setDoc(lectureDoc(db, uid, lectureId), {
        id: lectureId,
        subject,
        number,
        title: '',
        description: '',
        difficulty: 'normal',
        stage: 0,
        nextReview: null,
        isCompleted: false
    }, { merge: true });
    return lectureId;
};
