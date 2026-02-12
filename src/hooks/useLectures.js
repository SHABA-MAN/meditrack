import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot, query, collection, orderBy, deleteDoc } from 'firebase/firestore';

/**
 * Custom hook for managing lectures
 * @param {Object} db - Firestore database instance
 * @param {string} appId - Application ID
 * @param {Object} user - User object
 * @returns {Object} Lectures data and management functions
 */
export const useLectures = (db, appId, user) => {
    const [lectures, setLectures] = useState({});
    const [loading, setLoading] = useState(true);

    // Listen to lectures
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'artifacts', appId, 'users', user.uid, 'lectures'),
            orderBy('subject')
        );

        const unsubLectures = onSnapshot(q, (snap) => {
            const data = {};
            snap.forEach(doc => {
                data[doc.id] = { id: doc.id, ...doc.data() };
            });
            setLectures(data);
            setLoading(false);
        });

        return () => unsubLectures();
    }, [db, appId, user]);

    /**
     * Save or update lecture details
     */
    const saveLecture = async (lectureData) => {
        if (!user || !lectureData) return;

        const data = {
            id: lectureData.id,
            subject: lectureData.subject,
            number: lectureData.number,
            title: lectureData.title || '',
            description: lectureData.description || '',
            difficulty: lectureData.difficulty || 'normal',
            stage: lectureData.stage !== undefined ? lectureData.stage : 0,
            nextReview: lectureData.nextReview !== undefined ? lectureData.nextReview : null,
            isCompleted: lectureData.isCompleted || false
        };

        await setDoc(
            doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', lectureData.id),
            data,
            { merge: true }
        );
    };

    /**
     * Delete a lecture
     */
    const deleteLecture = async (lectureId) => {
        if (!user || !lectureId) return;

        await deleteDoc(
            doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', lectureId)
        );
    };

    /**
     * Get lectures for a specific subject
     */
    /**
     * Get lectures that need review today or overdue
     */
    const getReviewLectures = () => {
        if (!lectures) return [];
        const today = new Date().toISOString().split('T')[0];

        return Object.values(lectures).filter(lecture => {
            if (!lecture.nextReview || lecture.isCompleted) return false;
            // Extract date part only ensuring we compare YYYY-MM-DD to YYYY-MM-DD
            const reviewDate = lecture.nextReview.split('T')[0];
            return reviewDate <= today;
        });
    };

    /**
     * Get new (unstudied) lectures
     */
    const getNewLectures = (config) => {
        if (!config) return [];

        const newLectures = [];
        Object.keys(config).forEach(subject => {
            const total = parseInt(config[subject]) || 0;
            // Loop until we find the first unstudied lecture
            for (let i = 1; i <= total; i++) {
                const id = `${subject}_${i}`;
                const lecture = lectures[id];

                // If lecture doesn't exist in DB, or has stage 0, it's new
                if (!lecture || lecture.stage === 0) {
                    newLectures.push({
                        id,
                        subject,
                        number: i,
                        stage: 0,
                        title: lecture?.title || '',
                        description: lecture?.description || '',
                        difficulty: lecture?.difficulty || 'normal'
                    });
                    break; // Found the next new lecture for this subject
                }
            }
        });

        return newLectures;
    };

    /**
     * Get all lectures for a specific subject
     */
    const getSubjectLectures = (subjectCode, config) => {
        if (!config || !subjectCode) return [];

        const total = parseInt(config[subjectCode]) || 0;
        const list = [];

        for (let i = 1; i <= total; i++) {
            const id = `${subjectCode}_${i}`;
            const lecture = lectures[id] || {}; // Handle missing lectures gracefully

            list.push({
                id,
                subject: subjectCode,
                number: i,
                stage: lecture.stage !== undefined ? lecture.stage : 0,
                nextReview: lecture.nextReview || null,
                title: lecture.title || '',
                description: lecture.description || '',
                difficulty: lecture.difficulty || 'normal',
                isCompleted: lecture.isCompleted || false
            });
        }

        return list;
    };


    return {
        lectures,
        loading,
        saveLecture,
        deleteLecture,
        getSubjectLectures,
        getReviewLectures,
        getNewLectures
    };
};
