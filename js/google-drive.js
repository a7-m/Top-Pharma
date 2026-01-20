/**
 * Google Drive Upload Service
 * wrapper around Google API Client Library
 */

let tokenClient;
let gapiInited = false;
let gisInited = false;

/**
 * Load Google API scripts dynamically
 */
function loadGoogleScripts() {
    return new Promise((resolve) => {
        const script1 = document.createElement('script');
        script1.src = 'https://apis.google.com/js/api.js';
        script1.onload = () => {
            gapi.load('client', async () => {
                await gapi.client.init({
                    apiKey: GOOGLE_API_KEY,
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                });
                gapiInited = true;
                if (gisInited) resolve();
            });
        };
        document.body.appendChild(script1);

        const script2 = document.createElement('script');
        script2.src = 'https://accounts.google.com/gsi/client';
        script2.onload = () => {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: GOOGLE_SCOPES,
                callback: '', // defined later
            });
            gisInited = true;
            if (gapiInited) resolve();
        };
        document.body.appendChild(script2);
    });
}

/**
 * Request Access Token
 */
function requestGoogleAuth() {
    return new Promise((resolve, reject) => {
        if (!tokenClient) return reject('Google Scripts not loaded');
        
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                reject(resp);
            }
            resolve(resp);
        };

        // Prompt the user to select an account
        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
            tokenClient.requestAccessToken({prompt: ''});
        }
    });
}

/**
 * Upload to Google Drive (Resumable)
 * @param {File} file 
 * @param {Function} onProgress 
 */
async function uploadToGoogleDrive(file, onProgress) {
    if (!gapiInited || !gisInited) {
        throw new Error('Google API not initialized');
    }

    // Ensure we have a valid token
    await requestGoogleAuth();

    const metadata = {
        name: file.name,
        mimeType: file.type,
        // Optional: save in a specific folder if needed
        // parents: ['FOLDER_ID'] 
    };

    const accessToken = gapi.client.getToken().access_token;

    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink');
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
                
                // IMPORTANT: Make file public to anyone with link so students can view
                makeFilePublic(response.id).then(() => {
                    resolve({
                        id: response.id,
                        webViewLink: response.webViewLink,
                        webContentLink: response.webContentLink
                    });
                }).catch(err => {
                    console.warn('Could not make public', err);
                    resolve(response); // Return anyway
                });

            } else {
                reject(new Error('Google Drive Upload Failed: ' + xhr.statusText));
            }
        };

        xhr.onerror = () => reject(new Error('Network Error'));
        
        xhr.send(form);
    });
}

/**
 * Make file permission "anyone with link"
 */
async function makeFilePublic(fileId) {
    return gapi.client.drive.permissions.create({
        fileId: fileId,
        resource: {
            role: 'reader',
            type: 'anyone'
        }
    });
}
