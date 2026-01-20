// js/admin.js

let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Admin Auth
    const user = await checkAdminAccess();
    if (!user) return; // checkAdminAccess will redirect if not admin

    // 2. Handle Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabaseClient.auth.signOut();
            window.location.href = '../login.html';
        });
    }

    // 3. Check for Edit Mode
    const urlParams = new URLSearchParams(window.location.search);
    editingId = urlParams.get('id');

    // 4. Handle "Add Video" Form
    const addVideoForm = document.getElementById('addVideoForm');
    if (addVideoForm) {
        if (editingId) {
            document.querySelector('h2').textContent = 'تعديل الفيديو';
            document.querySelector('button[type="submit"]').textContent = 'حفظ التغييرات';
            loadVideoForEdit(editingId);
        }
        addVideoForm.addEventListener('submit', handleAddVideo);
    }

    // 5. Handle "Add File" Form
    const addFileForm = document.getElementById('addFileForm');
    if (addFileForm) {
        if (editingId) {
            document.querySelector('h2').textContent = 'تعديل الملف';
            document.querySelector('button[type="submit"]').textContent = 'حفظ التغييرات';
            loadFileForEdit(editingId);
        }
        addFileForm.addEventListener('submit', handleAddFile);
    }

    // 6. Handle "Create Quiz" Form
    const createQuizForm = document.getElementById('createQuizForm');
    if (createQuizForm) {
        setupQuizForm();
        if (editingId) {
            document.querySelector('h2').textContent = 'تعديل الاختبار';
            document.querySelector('button[type="submit"]').textContent = 'حفظ التغييرات';
            loadQuizForEdit(editingId);
        }
        createQuizForm.addEventListener('submit', handleCreateQuiz);
    }

    // 7. Initialize Google Drive Scripts (if config is present)
    if (typeof GOOGLE_CLIENT_ID !== 'undefined' && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID') {
        loadGoogleScripts().then(() => console.log('Google Scripts Loaded')).catch(console.error);
    }

    // 8. Handle Upload Source Toggle
    const uploadRadios = document.querySelectorAll('input[name="uploadSource"]');
    const uploadLabel = document.getElementById('uploadLabel');
    if (uploadRadios.length > 0 && uploadLabel) {
        // Detect context (Video vs File) based on initial label text
        const isVideo = uploadLabel.textContent.includes('فيديو');
        const entityName = isVideo ? 'فيديو' : 'ملف';

        uploadRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const source = e.target.value;
                if (source === 'cloudinary') {
                    uploadLabel.textContent = `رفع ${entityName} (Cloudinary)`;
                } else {
                    uploadLabel.textContent = `رفع ${entityName} (Google Drive)`;
                }
            });
        });
    }
});

/**
 * Check if the current user is an admin.
 * Redirects to login or home if not.
 */
async function checkAdminAccess() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = '../login.html';
        return null;
    }

    // Fetch user profile to check role
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (error || !profile || profile.role !== 'admin') {
        alert('غير مسموح لك بالدخول إلى هذه الصفحة (Admins Only).');
        window.location.href = '../index.html';
        return null;
    }

    return session.user;
}

/**
 * Load video for editing
 */
async function loadVideoForEdit(id) {
    try {
        const { data, error } = await supabaseClient
            .from('videos')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;
        
        document.getElementById('title').value = data.title;
        document.getElementById('description').value = data.description || '';
        document.getElementById('category').value = data.category;
        
        // Restore link logic roughly
        if (data.google_drive_id) {
             document.getElementById('videoLink').value = `https://drive.google.com/file/d/${data.google_drive_id}/view`;
        } else {
             document.getElementById('videoLink').value = data.video_url;
        }
    } catch (err) {
        console.error(err);
        alert('خطأ في تحميل بيانات الفيديو');
    }
}

/**
 * Load file for editing
 */
async function loadFileForEdit(id) {
    try {
        const { data, error } = await supabaseClient
            .from('files')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;
        
        document.getElementById('title').value = data.title;
        document.getElementById('description').value = data.description || '';
        document.getElementById('fileType').value = data.file_type;
        
        if (data.google_drive_id) {
             document.getElementById('fileLink').value = `https://drive.google.com/file/d/${data.google_drive_id}/view`;
        } else {
             document.getElementById('fileLink').value = data.file_url;
        }
    } catch (err) {
        console.error(err);
        alert('خطأ في تحميل بيانات الملف');
    }
}

/**
 * Load quiz for editing
 */
async function loadQuizForEdit(id) {
    try {
        const { data: quiz, error: quizError } = await supabaseClient
            .from('quizzes')
            .select('*')
            .eq('id', id)
            .single();

        if (quizError) throw quizError;

        document.getElementById('quizTitle').value = quiz.title;
        document.getElementById('quizDescription').value = quiz.description || '';
        document.getElementById('timeLimit').value = quiz.time_limit;
        document.getElementById('passingScore').value = quiz.passing_score;

        // Load questions
        const { data: questions, error: qError } = await supabaseClient
            .from('questions')
            .select('*')
            .eq('quiz_id', id)
            .order('order', { ascending: true });

        if (qError) throw qError;

        // Clear existing initial question
        const container = document.getElementById('questionsContainer');
        container.innerHTML = '';
        
        // Re-populate questions
        // We need access to the template and logic from setupQuizForm, but better to reuse or simulate click
        // For simplicity, let's manually reconstruct:
        const template = document.getElementById('questionTemplate');
        
        questions.forEach((q, index) => {
             const clone = template.content.cloneNode(true);
             const card = clone.querySelector('.question-card');
             card.dataset.questionIndex = index;

             // Set values
             card.querySelector('.question-text').value = q.question_text;
             const optionInputs = card.querySelectorAll('.option-input');
             q.options.forEach((opt, i) => {
                 if (optionInputs[i]) optionInputs[i].value = opt;
             });

             // Set correct answer
             const radios = card.querySelectorAll('input[type="radio"]');
             radios.forEach((radio, i) => {
                 radio.name = `correct_${index}`;
                 if (i === q.correct_answer) radio.checked = true;
             });

             // Remove event
             card.querySelector('.remove-question').addEventListener('click', () => card.remove());
             
             container.appendChild(clone);
        });
        
    } catch (err) {
        console.error(err);
        alert('خطأ في تحميل بيانات الاختبار');
    }
}

/**
 * Handle adding/editing a video
 */
async function handleAddVideo(e) {
    e.preventDefault();
    const messageEl = document.getElementById('message');
    messageEl.textContent = 'جاري الحفظ...';
    messageEl.className = 'mt-3 text-center text-info';

    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const category = document.getElementById('category').value;
    const videoLink = document.getElementById('videoLink').value;

    let videoUrl = videoLink;
    let driveId = null;
    let thumbnailUrl = null;
    let cloudinaryId = null;

    // Cloudinary/Drive Upload Logic
    const fileInput = document.getElementById('videoFile');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    const progressContainer = document.getElementById('uploadProgressContainer');
    const submitBtn = document.getElementById('submitBtn');
    
    // Check which source is selected
    const uploadSource = document.querySelector('input[name="uploadSource"]:checked')?.value || 'cloudinary';

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // Validate file type
        if (!file.type.startsWith('video/')) {
            alert('يرجى اختيار ملف فيديو صالح.');
            return;
        }

        // Validate file size (e.g., 500MB)
        const MAX_SIZE = 500 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            alert('حجم الملف كبير جدًا. الحد الأقصى هو 500 ميجابايت.');
            return;
        }

        try {
            submitBtn.disabled = true;
            progressContainer.style.display = 'block';

            if (uploadSource === 'cloudinary') {
                messageEl.textContent = 'جاري رفع الفيديو إلى Cloudinary... يرجى الانتظار';
                const uploadResult = await uploadToCloudinary(file, (percent) => {
                    progressBar.value = percent;
                    progressText.textContent = `${percent}%`;
                });

                videoUrl = uploadResult.secure_url;
                cloudinaryId = uploadResult.public_id;
                
                // Auto-generate thumbnail
                thumbnailUrl = videoUrl.replace(/\.[^/.]+$/, ".jpg");

            } else if (uploadSource === 'google') {
                messageEl.textContent = 'جاري رفع الفيديو إلى Google Drive... (قد يطلب تسجيل الدخول)';
                
                const uploadResult = await uploadToGoogleDrive(file, (percent) => {
                    progressBar.value = percent;
                    progressText.textContent = `${percent}%`;
                });

                videoUrl = uploadResult.webViewLink;
                driveId = uploadResult.id;
            }

        } catch (uploadError) {
            console.error(uploadError);
            messageEl.textContent = 'فشل الرفع: ' + uploadError.message;
            messageEl.className = 'mt-3 text-center text-danger';
            submitBtn.disabled = false;
            progressContainer.style.display = 'none';
            return;
        }
    }

    // Helper to extract Drive ID
    const getDriveId = (url) => {
        if (!url) return null;
        const patterns = [
            /\/d\/([a-zA-Z0-9_-]+)/,
            /id=([a-zA-Z0-9_-]+)/,
            /open\?id=([a-zA-Z0-9_-]+)/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    // Helper to process YouTube URL
    const getYouTubeEmbed = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
    };

    if (videoUrl && videoUrl.includes('drive.google.com')) {
        const extractedId = getDriveId(videoUrl);
        if (extractedId) {
            driveId = extractedId;
            videoUrl = `https://drive.google.com/file/d/${driveId}/preview`;
        }
    } else if (videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) {
        const embedUrl = getYouTubeEmbed(videoUrl);
        if (embedUrl) {
            videoUrl = embedUrl;
            // Auto-generate YouTube thumbnail
            const ytId = videoLink.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|u\/\w\/|shorts\/))([a-zA-Z0-9_-]{11})/);
            if (ytId) {
                thumbnailUrl = `https://img.youtube.com/vi/${ytId[1]}/hqdefault.jpg`;
            }
        }
    }

    try {
        const payload = {
            title,
            description,
            category,
            video_url: videoUrl,
            google_drive_id: driveId,
            cloudinary_id: cloudinaryId // New Field
        };
        
        // Only update thumbnail if we generated a new one
        if (thumbnailUrl) {
            payload.thumbnail_url = thumbnailUrl;
        }

        let error;
        if (editingId) {
             const { error: err } = await supabaseClient
                .from('videos')
                .update(payload)
                .eq('id', editingId);
             error = err;
        } else {
             const { error: err } = await supabaseClient
                .from('videos')
                .insert(payload);
             error = err;
        }

        if (error) throw error;

        messageEl.textContent = editingId ? 'تم حفظ التعديلات بنجاح!' : 'تم إضافة الفيديو بنجاح!';
        messageEl.className = 'mt-3 text-center text-success';
        if (!editingId) e.target.reset(); // Only reset if adding
        setTimeout(() => window.location.href = '../videos.html', 1500);

    } catch (err) {
        console.error(err);
        messageEl.textContent = 'حدث خطأ: ' + err.message;
        messageEl.className = 'mt-3 text-center text-danger';
    }
}

/**
 * Handle adding/editing a file
 */
async function handleAddFile(e) {
    e.preventDefault();
    const messageEl = document.getElementById('message');
    messageEl.textContent = 'جاري الحفظ...';
    messageEl.className = 'mt-3 text-center text-info';

    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const fileLink = document.getElementById('fileLink').value;
    const fileType = document.getElementById('fileType').value;

    let fileUrl = fileLink;
    let driveId = null;
    let cloudinaryId = null;

    // Cloudinary/Drive Upload Logic
    const fileInput = document.getElementById('fileInput');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    const progressContainer = document.getElementById('uploadProgressContainer');
    const submitBtn = document.querySelector('button[type="submit"]'); // Use generic selector or add ID to button in HTML
    
    // Check source
    // In add-file.html we added radios with name="uploadSource"
    const uploadSource = document.querySelector('input[name="uploadSource"]:checked')?.value || 'cloudinary';

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        try {
            messageEl.textContent = `جاري رفع الملف إلى ${uploadSource === 'cloudinary' ? 'Cloudinary' : 'Google Drive'}...`;
            submitBtn.disabled = true;
            progressContainer.style.display = 'block';

            if (uploadSource === 'cloudinary') {
                // Determine resource type
                let resourceType = 'raw';
                if (file.type.startsWith('image/')) resourceType = 'image';
                else if (file.type.startsWith('video/')) resourceType = 'video';
                
                const uploadResult = await uploadToCloudinary(file, (percent) => {
                    progressBar.value = percent;
                    progressText.textContent = `${percent}%`;
                }, resourceType);

                fileUrl = uploadResult.secure_url;
                cloudinaryId = uploadResult.public_id;
                
            } else if (uploadSource === 'google') {
                 const uploadResult = await uploadToGoogleDrive(file, (percent) => {
                    progressBar.value = percent;
                    progressText.textContent = `${percent}%`;
                });

                fileUrl = uploadResult.webViewLink;
                driveId = uploadResult.id;
            }

        } catch (uploadError) {
            console.error(uploadError);
            messageEl.textContent = 'فشل الرفع: ' + uploadError.message;
            messageEl.className = 'mt-3 text-center text-danger';
            submitBtn.disabled = false;
            progressContainer.style.display = 'none';
            return;
        }
    }

    const getDriveId = (url) => {
        if (!url) return null;
        const patterns = [
            /\/d\/([a-zA-Z0-9_-]+)/,
            /id=([a-zA-Z0-9_-]+)/,
            /open\?id=([a-zA-Z0-9_-]+)/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    if (fileUrl && fileUrl.includes('drive.google.com')) {
        const extractedId = getDriveId(fileUrl);
        if (extractedId) {
            driveId = extractedId;
            fileUrl = `https://drive.google.com/file/d/${driveId}/view`;
        }
    } else if (fileUrl && fileUrl.includes('cloudinary.com')) {
        // Cloudinary direct file link
        // fileUrl is already set
    }

    try {
        const payload = {
            title,
            description,
            file_type: fileType,
            file_url: fileUrl,
            google_drive_id: driveId,
            cloudinary_id: cloudinaryId
        };

        let error;
        if (editingId) {
            const { error: err } = await supabaseClient
                .from('files')
                .update(payload)
                .eq('id', editingId);
            error = err;
        } else {
             const { error: err } = await supabaseClient
                .from('files')
                .insert(payload);
             error = err;
        }

        if (error) throw error;

        messageEl.textContent = editingId ? 'تم حفظ التعديلات بنجاح!' : 'تم إضافة الملف بنجاح!';
        messageEl.className = 'mt-3 text-center text-success';
        if (!editingId) e.target.reset();
        setTimeout(() => window.location.href = '../files.html', 1500);

    } catch (err) {
        console.error(err);
        messageEl.textContent = 'حدث خطأ: ' + err.message;
        messageEl.className = 'mt-3 text-center text-danger';
    }
}

/**
 * Setup dynamic question adding for Quiz
 */
function setupQuizForm() {
    const addBtn = document.getElementById('addQuestionBtn');
    const container = document.getElementById('questionsContainer');
    const template = document.getElementById('questionTemplate');
    // Important: Counter to keep radio names unique
    let questionCounter = container.children.length; 

    addBtn.addEventListener('click', () => {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.question-card');
        
        // Find max existing index to avoid conflicts
        const existingIndices = Array.from(container.children).map(c => parseInt(c.dataset.questionIndex || 0));
        const newIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 0;
        
        card.dataset.questionIndex = newIndex;
        
        // Fix radio names to be unique per question
        const radios = card.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            radio.name = `correct_${newIndex}`;
        });

        // Remove event
        const removeBtn = card.querySelector('.remove-question');
        removeBtn.addEventListener('click', () => {
            card.remove();
        });

        container.appendChild(clone);
    });

    // Add one initial question ONLY if not editing (will be handled by loadQuizForEdit)
    if (!editingId && container.children.length === 0) {
        addBtn.click();
    }
}

/**
 * Handle creating/editing a quiz
 */
async function handleCreateQuiz(e) {
    e.preventDefault();
    const messageEl = document.getElementById('message');
    messageEl.textContent = 'جاري الحفظ...';
    messageEl.className = 'mt-3 text-center text-info';

    const title = document.getElementById('quizTitle').value;
    const description = document.getElementById('quizDescription').value;
    const timeLimit = document.getElementById('timeLimit').value;
    const passingScore = document.getElementById('passingScore').value;

    try {
        let quizId = editingId;
        const quizPayload = {
            title,
            description,
            time_limit: parseInt(timeLimit),
            passing_score: parseInt(passingScore)
        };

        // 1. Create/Update Quiz Record
        if (editingId) {
             const { error: quizError } = await supabaseClient
                .from('quizzes')
                .update(quizPayload)
                .eq('id', editingId);
             if (quizError) throw quizError;
        } else {
             const { data: quizData, error: quizError } = await supabaseClient
                .from('quizzes')
                .insert(quizPayload)
                .select()
                .single();
             if (quizError) throw quizError;
             quizId = quizData.id;
        }

        // 2. Gather Questions
        const questions = [];
        const questionCards = document.querySelectorAll('.question-card');
        
        questionCards.forEach((card, index) => {
            const text = card.querySelector('.question-text').value;
            const optionInputs = card.querySelectorAll('.option-input');
            const options = Array.from(optionInputs).map(inp => inp.value);
            
            // Find selected correct answer index
            const radios = card.querySelectorAll(`input[type="radio"]`);
            let correctIndex = 0;
            radios.forEach((r, i) => {
                if (r.checked) correctIndex = i;
            });

            questions.push({
                quiz_id: quizId,
                question_text: text,
                options: options, // This will be JSON
                correct_answer: correctIndex,
                "order": index + 1
            });
        });

        if (questions.length === 0) {
            throw new Error('يجب إضافة سؤال واحد على الأقل.');
        }

        // 3. Update Questions (Delete all old, insert new for simplicity)
        // Note: For large datasets this is bad, but for simple quizzes it's easiest.
        if (editingId) {
            await supabaseClient.from('questions').delete().eq('quiz_id', quizId);
        }

        const { error: qError } = await supabaseClient
            .from('questions')
            .insert(questions);

        if (qError) throw qError;

        messageEl.textContent = editingId ? 'تم حفظ التعديلات بنجاح!' : 'تم إنشاء الاختبار بنجاح!';
        messageEl.className = 'mt-3 text-center text-success';
        if (!editingId) e.target.reset();
        setTimeout(() => window.location.href = '../quizzes.html', 1500);

    } catch (err) {
        console.error(err);
        messageEl.textContent = 'حدث خطأ: ' + err.message;
        messageEl.className = 'mt-3 text-center text-danger';
    }
}
