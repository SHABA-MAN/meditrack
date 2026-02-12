import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

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

    /**
     * Add or update a subject
     */
    const handleAddSubject = async (subjectData, editingCode = null) => {
        if (!subjectData.code || !subjectData.name) {
            throw new Error('يرجى ملء الكود والاسم');
        }

        const code = subjectData.code.toUpperCase().replace(/[^A-Z0-9]/g, '');

        // Check for duplicates only if not editing
        if (!editingCode && subjects[code]) {
            throw new Error('هذا الكود موجود بالفعل!');
        }

        // Import THEMES from constants
        const { THEMES } = await import('../constants');
        const theme = THEMES[subjectData.theme];

        const newData = {
            ...subjects,
            [code]: {
                ...theme,
                name: subjectData.name,
                theme: subjectData.theme
            }
        };

        await setDoc(
            doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'),
            newData
        );

        // Initialize config if new subject
        if (!editingCode && (!config || config[code] === undefined)) {
            await setDoc(
                doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'),
                { ...config, [code]: 0 },
                { merge: true }
            );
        }

        return code;
    };

    /**
     * Delete a subject
     */
    const deleteSubject = async (code) => {
        const newData = { ...subjects };
        delete newData[code];
        await setDoc(
            doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'),
            newData
        );
    };

    /**
     * Get subject statistics
     */
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

    return {
        subjects,
        config,
        loading,
        handleAddSubject,
        deleteSubject,
        getSubjectStats
    };
};
