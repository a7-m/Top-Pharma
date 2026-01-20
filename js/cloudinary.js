/**
 * Cloudinary Upload Service
 */

/**
 * Upload file to Cloudinary
 * @param {File} file - The file to upload
 * @param {Function} onProgress - Callback for upload progress (0-100)
 * @param {string} resourceType - 'video', 'image', 'raw', or 'auto' (default: 'video')
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
async function uploadToCloudinary(file, onProgress, resourceType = 'video') {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET || CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME') {
        throw new Error('Please configure Cloudinary settings in js/config.js');
    }

    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
    const formData = new FormData();
    
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    // Folder can be dynamic based on type if needed, keeping it simple for now
    formData.append('folder', `al-pharmacist/${resourceType}s`); 

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open('POST', url, true);

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
                    secure_url: response.secure_url,
                    public_id: response.public_id
                });
            } else {
                reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error('Network error during upload'));
        };

        xhr.send(formData);
    });
}
