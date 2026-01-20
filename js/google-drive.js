/**
 * Google Drive Upload Service
 * Using Google Identity Services (GIS) and Fetch API
 * Bypasses GAPI discovery docs to avoid 502 and "missing required fields" errors
 */

let tokenClient;
let gapiInited = false;
let gisInited = false;
let currentAccessToken = null;

/**
 * Load Google API scripts dynamically
 */
function loadGoogleScripts() {
    return new Promise((resolve, reject) => {
        // Load GIS (Google Identity Services)
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => {
            try {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: GOOGLE_SCOPES,
                    callback: (resp) => {
                        if (resp.access_token) {
                            currentAccessToken = resp.access_token;
                        }
                    },
                });
                gisInited = true;
                gapiInited = true; // Set both to true to satisfy admin.js check
                console.log('Google Identity Services loaded');
                resolve();
            } catch (err) {
                console.error('Error initializing GIS client:', err);
                reject(err);
            }
        };
        script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
        document.body.appendChild(script);
    });
}

/**
 * Request Access Token
 */
function requestGoogleAuth() {
    return new Promise((resolve, reject) => {
        if (!tokenClient) return reject('Google Scripts not loaded');
        
        tokenClient.callback = (resp) => {
            if (resp.error !== undefined) {
                return reject(resp);
            }
            currentAccessToken = resp.access_token;
            resolve(resp);
        };

        // Always request token, GIS handles expiry/refresh internally or we just prompt
        // If we want to avoid prompt if already have token, we could check, 
        // but simple for now:
        tokenClient.requestAccessToken({ prompt: currentAccessToken ? '' : 'consent' });
    });
}

/**
 * Upload to Google Drive (Resumable-ish using Multipart)
 * @param {File} file 
 * @param {Function} onProgress 
 */
async function uploadToGoogleDrive(file, onProgress) {
    if (!gisInited) {
        throw new Error('Google API has not been initialized. Please check your internet connection and verify your Client ID.');
    }

    // Ensure we have a valid token
    await requestGoogleAuth();

    const metadata = {
        name: file.name,
        mimeType: file.type,
    };

    const accessToken = currentAccessToken;

    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const xhr = new XMLHttpRequest();
        // We use the direct upload endpoint and request specific fields
        // thumbnailLink is short-lived, so we'll use a permanent-ish URL constructed from ID
        xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink,thumbnailLink,videoMediaMetadata');
        xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
        
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                if (onProgress) onProgress(Math.round(percent));
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                
                // Get duration in seconds if it's a video
                let duration = null;
                if (response.videoMediaMetadata && response.videoMediaMetadata.durationMillis) {
                    duration = Math.round(parseInt(response.videoMediaMetadata.durationMillis) / 1000);
                }

                // Construct a more stable thumbnail URL
                // The thumbnailLink expires, but this URL usually works if file is public
                const stableThumbnail = `https://lh3.googleusercontent.com/u/0/d/${response.id}=w400-h225-p`;
                // Alternatively: https://drive.google.com/thumbnail?id=${response.id}&sz=w400

                // Make file public to anyone with link
                makeFilePublic(response.id, accessToken).then(() => {
                    resolve({
                        id: response.id,
                        webViewLink: response.webViewLink,
                        webContentLink: response.webContentLink,
                        thumbnailUrl: stableThumbnail || response.thumbnailLink,
                        duration: duration
                    });
                }).catch(err => {
                    console.warn('Could not make public automatically', err);
                    resolve({
                        ...response,
                        thumbnailUrl: stableThumbnail || response.thumbnailLink,
                        duration: duration
                    });
                });

            } else {
                console.error('Upload failed', xhr.responseText);
                reject(new Error(`Google Drive Upload Failed (${xhr.status}): ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => reject(new Error('Network Error during upload'));
        
        xhr.send(form);
    });
}

/**
 * Make file permission "anyone with link" using direct fetch
 */
async function makeFilePublic(fileId, accessToken) {
    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                role: 'reader',
                type: 'anyone'
            })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Failed to update permissions');
        }
        
        return await response.json();
    } catch (err) {
        console.error('Error making file public:', err);
        throw err;
    }
}
