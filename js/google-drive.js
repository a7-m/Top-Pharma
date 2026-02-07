/**
 * Google Drive Upload Service (Secure - via Backend)
 * All uploads are now proxied through our secure backend
 * Uses Google OAuth2 for authentication
 */

let gapiInited = false;
let tokenClient = null;
let googleAccessToken = null;

/**
 * Load Google API scripts
 */
function loadGoogleScripts() {
    return new Promise((resolve, reject) => {
        if (gapiInited) {
            resolve();
            return;
        }

        // Load Google Identity Services
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            initializeGoogleAuth();
            gapiInited = true;
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Google API'));
        document.head.appendChild(script);
    });
}

/**
 * Initialize Google OAuth2 client
 */
function initializeGoogleAuth() {
    if (typeof google === 'undefined') {
        console.error('Google API not loaded');
        return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response) => {
            if (response.access_token) {
                googleAccessToken = response.access_token;
                console.log('Google Drive authenticated successfully');
            }
        },
    });
}

/**
 * Request Google Drive access token
 */
function requestGoogleAccess() {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            reject(new Error('Google Auth not initialized. Please reload the page.'));
            return;
        }

        // Set callback for this specific request
        tokenClient.callback = (response) => {
            if (response.error) {
                reject(new Error(response.error));
                return;
            }
            
            if (response.access_token) {
                googleAccessToken = response.access_token;
                resolve(response.access_token);
            } else {
                reject(new Error('No access token received'));
            }
        };

        // Request access token
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
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

        // Ensure Google scripts are loaded
        if (!gapiInited) {
            await loadGoogleScripts();
        }

        // Request Google access if not already authenticated
        if (!googleAccessToken) {
            googleAccessToken = await requestGoogleAccess();
        }

        // Prepare form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('googleAccessToken', googleAccessToken);

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
                } else if (xhr.status === 400) {
                    // Token might be expired, try to get a new one
                    const error = JSON.parse(xhr.responseText);
                    if (error.error && error.error.includes('رمز الوصول')) {
                        // Clear token and retry
                        googleAccessToken = null;
                        reject(new Error('انتهت صلاحية تسجيل الدخول. يرجى المحاولة مرة أخرى.'));
                    } else {
                        reject(new Error(error.error || 'فشل رفع الملف'));
                    }
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
