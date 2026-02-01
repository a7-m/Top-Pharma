/**
 * Google Drive Upload Service (Secure - via Backend)
 * All uploads are now proxied through our secure backend
 * Google API credentials are never exposed to the frontend
 */

let gapiInited = true; // Keep for backward compatibility with admin.js

/**
 * Load Google API scripts - No longer needed but kept for compatibility
 */
function loadGoogleScripts() {
    return Promise.resolve();
}

/**
 * Upload to Google Drive via Backend API
 * @param {File} file 
 * @param {Function} onProgress 
 */
async function uploadToGoogleDrive(file, onProgress) {
    try {
        // Get auth token
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }

        // Prepare form data
        const formData = new FormData();
        formData.append('file', file);

        // Upload via XMLHttpRequest for progress tracking
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.open('POST', `${BACKEND_URL}/api/upload/google-drive`, true);
            xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);

            // Upload progress
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    if (onProgress) onProgress(Math.round(percentComplete));
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    resolve({
                        id: response.id,
                        webViewLink: response.webViewLink,
                        webContentLink: response.webContentLink,
                        thumbnailUrl: response.thumbnailUrl,
                        duration: response.duration
                    });
                } else if (xhr.status === 501) {
                    // Not implemented - fallback to error
                    reject(new Error('رفع Google Drive غير مفعّل حاليًا. يرجى استخدام Cloudinary.'));
                } else {
                    const error = JSON.parse(xhr.responseText);
                    reject(new Error(error.error || 'فشل رفع الملف إلى Google Drive'));
                }
            };

            xhr.onerror = () => {
                reject(new Error('خطأ في الشبكة أثناء الرفع'));
            };

            xhr.send(formData);
        });
    } catch (error) {
        console.error('Google Drive upload error:', error);
        throw error;
    }
}
