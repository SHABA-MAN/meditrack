import { collection, doc, setDoc, getDoc, getDocs, updateDoc, arrayUnion, query, where, orderBy } from 'firebase/firestore';

/**
 * تسجيل إنجاز جديد في Firestore
 * @param {Object} db - Firestore database instance
 * @param {string} userId - User ID
 * @param {string} type - نوع الإنجاز: 'study' أو 'task'
 * @param {Object} data - بيانات الإنجاز
 */
export const logAchievement = async (db, userId, type, data) => {
  try {
    // الحصول على التاريخ الحالي بصيغة YYYY-MM-DD
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0]; // مثال: "2026-01-28"

    // Updated to use standardized artifacts path
    const achievementRef = doc(db, 'artifacts', 'meditrack-v1', 'users', userId, 'achievements', dateKey);

    // التحقق من وجود المستند
    const achievementDoc = await getDoc(achievementRef);

    const achievementEntry = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type, // 'study' or 'task'
      timestamp: now.toISOString(),
      ...data
    };

    if (achievementDoc.exists()) {
      // إضافة إلى القائمة الموجودة
      await updateDoc(achievementRef, {
        items: arrayUnion(achievementEntry)
      });
    } else {
      // إنشاء مستند جديد
      await setDoc(achievementRef, {
        date: dateKey,
        items: [achievementEntry]
      });
    }

    console.log('✅ Achievement logged:', achievementEntry);
    return true;
  } catch (error) {
    console.error('❌ Error logging achievement:', error);
    return false;
  }
};

/**
 * جلب إنجازات شهر معين — نسخة محسنة
 * تستخدم استعلام where بدلاً من 30 طلب getDoc منفصل
 * @param {Object} db - Firestore database instance
 * @param {string} userId - User ID
 * @param {number} year - السنة
 * @param {number} month - الشهر (0-11)
 */
export const getMonthAchievements = async (db, userId, year, month) => {
  try {
    const achievements = {};

    // Build date range strings
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // Try new path first (with artifacts) — single query for the whole month
    const newPathCol = collection(db, 'artifacts', 'meditrack-v1', 'users', userId, 'achievements');

    try {
      const q = query(newPathCol, where('date', '>=', startDate), where('date', '<=', endDate));
      const snapshot = await getDocs(q);

      snapshot.forEach(docSnap => {
        achievements[docSnap.id] = docSnap.data();
      });
    } catch (queryError) {
      // Fallback: If the 'date' field doesn't exist or index is missing,
      // use doc ID range (document IDs are date strings, so alphabetical ordering works)
      console.warn('Query fallback: fetching by document ID range', queryError);

      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const docRef = doc(db, 'artifacts', 'meditrack-v1', 'users', userId, 'achievements', dateKey);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          achievements[dateKey] = docSnap.data();
        }
      }
    }

    // Also check legacy path for any old data not yet migrated
    if (Object.keys(achievements).length === 0) {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const oldPathRef = doc(db, 'users', userId, 'achievements', dateKey);
        const oldPathDoc = await getDoc(oldPathRef);
        if (oldPathDoc.exists()) {
          achievements[dateKey] = oldPathDoc.data();
        }
      }
    }

    return achievements;
  } catch (error) {
    console.error('❌ Error fetching achievements:', error);
    return {};
  }
};
