import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { THEMES } from '../constants';

/**
 * Custom hook for managing subjects
 * @param {Object} db - Firestore database instance
 * @param {string} appId - Application ID
 * @param {Object} user - User object
 * @returns {Object} Subjects data and management functions
 */
export const useSubjects = (db, appId, user) => {
    const [subjects, setSubjects] = useState({});
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);

    // Listen to subjects definitions
    useEffect(() => {
        if (!user) return;

        const unsubDefinitions = onSnapshot(
            doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'),
            (snap) => {
                setSubjects(snap.exists() ? snap.data() : {});
                setLoading(false);
            }
        );

        const unsubConfig = onSnapshot(
            doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'),
            (snap) => {
                setConfig(snap.exists() ? snap.data() : {});
            }
        );

        return () => {
            unsubDefinitions();
            unsubConfig();
        };
    }, [db, appId, user]);

    const handleAddSubject = async (newSubject, editingCode = null) => {
        if (!newSubject.code || !newSubject.name) throw new Error("يرجى إدخال الكود والاسم");

        const code = newSubject.code.toUpperCase();

        // Remove old subject if editing code changed (not supported by this simple logic yet, 
        // usually editing code requires deleting old doc field and adding new one, 
        // but here we are just updating the field in a single map)

        if (editingCode && editingCode !== code) {
            throw new Error("لا يمكن تعديل الكود حالياً، يرجى حذف المادة وإضافتها مجدداً");
        }

        const currentSubjects = { ...subjects };
        currentSubjects[code] = {
            name: newSubject.name,
            theme: newSubject.theme,
            badge: THEMES[newSubject.theme].badge
        };

        if (editingCode && editingCode !== code) {
            delete currentSubjects[editingCode];
        }

        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), currentSubjects);
    };

    const deleteSubject = async (code) => {
        const newSubjects = { ...subjects };
        delete newSubjects[code];
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), newSubjects);
    };

    const getSubjectStats = (subjectCode, lectures = {}) => {
        const total = parseInt(config?.[subjectCode] || 0);
        let started = 0;

        Object.values(lectures).forEach(lecture => {
            if (lecture.subject === subjectCode && lecture.stage > 0) {
                started++;
            }
        });

        const newCount = Math.max(0, total - started);
        return { total, new: newCount };
    };

    return { subjects, config, handleAddSubject, deleteSubject, getSubjectStats };
};
