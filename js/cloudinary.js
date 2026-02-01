/**
 * Cloudinary Upload Service (Secure - via Backend)
 * All uploads are now proxied through our secure backend
 */

/**
 * Upload file to Cloudinary via Backend API
 * @param {File} file - The file to upload
 * @param {Function} onProgress - Callback for upload progress (0-100)
 * @param {string} resourceType - 'video', 'image', 'raw', or 'auto' (default: 'video')
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
async function uploadToCloudinary(file, onProgress, resourceType = 'video') {
    try {
        // Get auth token
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }

        // Prepare form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('resourceType', resourceType);
        formData.append('folder', `Top Pharma/${resourceType}s`);

        // Upload via XMLHttpRequest for progress tracking
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.open('POST', `${BACKEND_URL}/api/upload/cloudinary`, true);
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
                    if (response.success) {
                        resolve({
                            secure_url: response.secure_url,
                            public_id: response.public_id,
                            duration: response.duration
                        });
                    } else {
                        reject(new Error('فشل رفع الملف'));
                    }
                } else {
                    const error = JSON.parse(xhr.responseText);
                    reject(new Error(error.error || 'فشل رفع الملف إلى Cloudinary'));
                }
            };

            xhr.onerror = () => {
                reject(new Error('خطأ في الشبكة أثناء الرفع'));
            };

            xhr.send(formData);
        });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}
