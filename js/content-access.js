/**
 * Content Access Utility
 * Verifies user access to content via backend API
 */

/**
 * Verify if user has access to a section
 * @param {number} sectionId - ID of the section
 * @returns {Promise<boolean>}
 */
async function verifySectionAccess(sectionId) {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            return false;
        }

        const response = await fetch(`${BACKEND_URL}/api/verify-access`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                sectionId: sectionId,
                contentType: 'section'
            })
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return data.hasAccess;
    } catch (error) {
        console.error('Error verifying section access:', error);
        return false;
    }
}

/**
 * Verify if user has access to a video
 * @param {number} videoId - ID of the video
 * @returns {Promise<boolean>}
 */
async function verifyVideoAccess(videoId) {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            return false;
        }

        const response = await fetch(`${BACKEND_URL}/api/verify-access`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                contentId: videoId,
                contentType: 'video'
            })
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return data.hasAccess;
    } catch (error) {
        console.error('Error verifying video access:', error);
        return false;
    }
}

/**
 * Verify if user has access to a quiz
 * @param {number} quizId - ID of the quiz
 * @returns {Promise<boolean>}
 */
async function verifyQuizAccess(quizId) {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            return false;
        }

        const response = await fetch(`${BACKEND_URL}/api/verify-access`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                contentId: quizId,
                contentType: 'quiz'
            })
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return data.hasAccess;
    } catch (error) {
        console.error('Error verifying quiz access:', error);
        return false;
    }
}

/**
 * Verify if user has access to a file
 * @param {number} fileId - ID of the file
 * @returns {Promise<boolean>}
 */
async function verifyFileAccess(fileId) {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            return false;
        }

        const response = await fetch(`${BACKEND_URL}/api/verify-access`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                contentId: fileId,
                contentType: 'file'
            })
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return data.hasAccess;
    } catch (error) {
        console.error('Error verifying file access:', error);
        return false;
    }
}

/**
 * Generate a signed URL for content access
 * @param {number} contentId - ID of the content
 * @param {string} contentType - Type: 'video', 'quiz', or 'file'
 * @returns {Promise<object>} - {signedParams, expiresAt}
 */
async function generateContentSignedUrl(contentId, contentType) {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }

        const response = await fetch(`${BACKEND_URL}/api/generate-signed-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                contentId: contentId,
                contentType: contentType
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'فشل توليد رابط الوصول');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error generating signed URL:', error);
        throw error;
    }
}

/**
 * Verify a signed URL
 * @param {object} signedParams - Signed parameters
 * @returns {Promise<boolean>}
 */
async function verifyContentSignedUrl(signedParams) {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            return false;
        }

        const response = await fetch(`${BACKEND_URL}/api/verify-signed-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                signedParams: signedParams
            })
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return data.valid;
    } catch (error) {
        console.error('Error verifying signed URL:', error);
        return false;
    }
}
