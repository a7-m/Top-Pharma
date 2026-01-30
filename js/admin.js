// js/admin.js

let editingId = null;
let subjectPaymentsCache = [];

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

    // 7. Handle "Subject Payments" Page
    const subjectPricesBody = document.getElementById('subjectPricesBody');
    if (subjectPricesBody) {
        initSubjectPaymentsPage();
    }

    // 8. Initialize Google Drive Scripts (if config is present)
    if (typeof GOOGLE_CLIENT_ID !== 'undefined' && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID') {
        loadGoogleScripts().then(() => console.log('Google Scripts Loaded')).catch(console.error);
    }

    // 9. Handle Upload Source Toggle
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

// ================================
// Subject Prices & Activation Codes
// ================================

async function initSubjectPaymentsPage() {
    const subjectPricesBody = document.getElementById('subjectPricesBody');
    const subjectSelect = document.getElementById('activationSubjectSelect');
    const addCodeBtn = document.getElementById('addActivationCodeBtn');
    const generateBtn = document.getElementById('generateActivationCodesBtn');

    try {
        const subjects = await getAllSubjects();
        subjectPaymentsCache = subjects;
        renderSubjectPrices(subjects);
        renderSubjectOptions(subjects, subjectSelect);

        if (subjectSelect && subjects.length > 0) {
            subjectSelect.value = subjects[0].id;
            await loadActivationCodes(subjectSelect.value);
        }
    } catch (error) {
        console.error('Error loading subject payments:', error);
        showError('حدث خطأ أثناء تحميل بيانات المواد');
    }

    if (subjectSelect) {
        subjectSelect.addEventListener('change', async () => {
            await loadActivationCodes(subjectSelect.value);
        });
    }

    if (addCodeBtn) {
        addCodeBtn.addEventListener('click', handleAddActivationCode);
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerateActivationCodes);
    }
}

function renderSubjectPrices(subjects) {
    const subjectPricesBody = document.getElementById('subjectPricesBody');
    if (!subjectPricesBody) return;

    subjectPricesBody.innerHTML = subjects.map(subject => `
        <tr>
            <td>
                <strong>${subject.name_ar}</strong>
                <div class="text-muted" style="font-size: 0.85rem;">${subject.name_en}</div>
            </td>
            <td>
                <input
                    type="number"
                    min="0"
                    class="form-input subject-price-input"
                    data-subject-id="${subject.id}"
                    value="${Number.isFinite(subject.price_egp) ? subject.price_egp : 0}"
                />
            </td>
            <td>
                <button class="btn btn-primary btn-sm subject-price-save" data-subject-id="${subject.id}">حفظ</button>
            </td>
        </tr>
    `).join('');

    subjectPricesBody.querySelectorAll('.subject-price-save').forEach(button => {
        button.addEventListener('click', async () => {
            const subjectId = button.dataset.subjectId;
            const input = subjectPricesBody.querySelector(`.subject-price-input[data-subject-id="${subjectId}"]`);
            if (!input) return;
            const price = Math.max(0, parseInt(input.value, 10) || 0);
            input.value = price;
            await updateSubjectPrice(subjectId, price);
        });
    });
}

async function updateSubjectPrice(subjectId, price) {
    try {
        const { error } = await supabaseClient
            .from('subjects')
            .update({ price_egp: price })
            .eq('id', subjectId);

        if (error) throw error;
        showSuccess('تم تحديث سعر المادة بنجاح');
    } catch (error) {
        console.error('Error updating subject price:', error);
        showError('حدث خطأ أثناء تحديث السعر');
    }
}

function renderSubjectOptions(subjects, selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = subjects.map(subject => `
        <option value="${subject.id}">${subject.icon || '📚'} ${subject.name_ar}</option>
    `).join('');
}

async function loadActivationCodes(subjectId) {
    const codesBody = document.getElementById('activationCodesBody');
    if (!codesBody) return;

    if (!subjectId) {
        codesBody.innerHTML = '<tr><td colspan="5" class="text-center">اختر مادة لعرض الأكواد.</td></tr>';
        return;
    }

    codesBody.innerHTML = '<tr><td colspan="5" class="text-center">جاري تحميل الأكواد...</td></tr>';

    try {
        const { data, error } = await supabaseClient
            .from('subject_activation_codes')
            .select('id, code, is_used, used_at, used_by')
            .eq('subject_id', subjectId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderActivationCodes(data || []);
    } catch (error) {
        console.error('Error loading activation codes:', error);
        codesBody.innerHTML = '<tr><td colspan="5" class="text-center">تعذر تحميل الأكواد.</td></tr>';
    }
}

function renderActivationCodes(codes) {
    const codesBody = document.getElementById('activationCodesBody');
    if (!codesBody) return;

    if (codes.length === 0) {
        codesBody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد أكواد حالياً.</td></tr>';
        return;
    }

    codesBody.innerHTML = codes.map(code => {
        const usedBy = code.used_by ? code.used_by.slice(0, 8) : '-';
        return `
            <tr>
                <td><code>${code.code}</code></td>
                <td>${code.is_used ? 'مستخدم' : 'متاح'}</td>
                <td>${code.is_used ? usedBy : '-'}</td>
                <td>${code.used_at ? formatDate(code.used_at) : '-'}</td>
                <td>
                    <button
                        class="btn btn-sm btn-danger activation-code-delete"
                        data-code-id="${code.id}"
                        data-used="${code.is_used}"
                        ${code.is_used ? 'disabled' : ''}
                    >حذف</button>
                </td>
            </tr>
        `;
    }).join('');

    codesBody.querySelectorAll('.activation-code-delete').forEach(button => {
        button.addEventListener('click', async () => {
            await deleteActivationCode(button.dataset.codeId, button.dataset.used === 'true');
        });
    });
}

async function handleAddActivationCode() {
    const subjectSelect = document.getElementById('activationSubjectSelect');
    const codeInput = document.getElementById('newActivationCode');

    const subjectId = subjectSelect?.value;
    const code = codeInput?.value.trim();

    if (!subjectId || !code) {
        showActivationMessage('يرجى اختيار المادة وإدخال الكود.', 'danger');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('subject_activation_codes')
            .insert({ subject_id: subjectId, code });

        if (error) throw error;

        showActivationMessage('تم إضافة الكود بنجاح.', 'success');
        codeInput.value = '';
        await loadActivationCodes(subjectId);
    } catch (error) {
        console.error('Error adding activation code:', error);
        showActivationMessage('تعذر إضافة الكود. تأكد أنه غير مستخدم.', 'danger');
    }
}

async function handleGenerateActivationCodes() {
    const subjectSelect = document.getElementById('activationSubjectSelect');
    const countInput = document.getElementById('bulkActivationCount');

    const subjectId = subjectSelect?.value;
    const count = Math.max(1, parseInt(countInput?.value, 10) || 1);

    if (!subjectId) {
        showActivationMessage('يرجى اختيار المادة أولاً.', 'danger');
        return;
    }

    const codesSet = new Set();
    while (codesSet.size < count) {
        codesSet.add(generateActivationCode());
    }

    const payload = Array.from(codesSet).map(code => ({
        subject_id: subjectId,
        code
    }));

    try {
        const { error } = await supabaseClient
            .from('subject_activation_codes')
            .insert(payload);

        if (error) throw error;

        showActivationMessage('تم توليد الأكواد بنجاح.', 'success');
        await loadActivationCodes(subjectId);
    } catch (error) {
        console.error('Error generating activation codes:', error);
        showActivationMessage('تعذر توليد الأكواد. حاول مرة أخرى.', 'danger');
    }
}

async function deleteActivationCode(codeId, isUsed) {
    if (isUsed) {
        showActivationMessage('لا يمكن حذف كود مستخدم.', 'danger');
        return;
    }

    if (!confirm('هل أنت متأكد من حذف هذا الكود؟')) return;

    try {
        const { error } = await supabaseClient
            .from('subject_activation_codes')
            .delete()
            .eq('id', codeId);

        if (error) throw error;

        const subjectSelect = document.getElementById('activationSubjectSelect');
        if (subjectSelect?.value) {
            await loadActivationCodes(subjectSelect.value);
        }
        showActivationMessage('تم حذف الكود.', 'success');
    } catch (error) {
        console.error('Error deleting activation code:', error);
        showActivationMessage('تعذر حذف الكود.', 'danger');
    }
}

function generateActivationCode() {
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `ALP-${randomPart}`;
}

function showActivationMessage(message, type = 'info') {
    const messageEl = document.getElementById('activationMessage');
    if (!messageEl) return;

    const typeClass = type === 'success' ? 'text-success' : type === 'danger' ? 'text-danger' : 'text-info';
    messageEl.textContent = message;
    messageEl.className = `mt-2 text-center ${typeClass}`;
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

    let videoDuration = null;

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
                videoDuration = uploadResult.duration;
                
                // Auto-generate optimized thumbnail
                thumbnailUrl = videoUrl.replace('/upload/', '/upload/c_fill,w_400,h_225,g_auto,f_jpg/').replace(/\.[^/.]+$/, ".jpg");

            } else if (uploadSource === 'google') {
                messageEl.textContent = 'جاري رفع الفيديو إلى Google Drive... (قد يطلب تسجيل الدخول)';
                
                const uploadResult = await uploadToGoogleDrive(file, (percent) => {
                    progressBar.value = percent;
                    progressText.textContent = `${percent}%`;
                });

                videoUrl = uploadResult.webViewLink;
                driveId = uploadResult.id;
                thumbnailUrl = uploadResult.thumbnailUrl;
                videoDuration = uploadResult.duration;
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
            // Set thumbnail for pasted link if not already set by upload
            if (!thumbnailUrl) {
                thumbnailUrl = `https://lh3.googleusercontent.com/u/0/d/${driveId}=w400-h225-p`;
            }
        }
    } else if (videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) {
        const embedUrl = getYouTubeEmbed(videoUrl);
        if (embedUrl) {
            videoUrl = embedUrl;
            // Auto-generate YouTube thumbnail
            const ytId = videoUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
            if (ytId) {
                thumbnailUrl = `https://img.youtube.com/vi/${ytId[1]}/hqdefault.jpg`;
            }
        }
    }

    const subjectId = document.getElementById('subject')?.value;
    const sectionId = document.getElementById('section')?.value;
    
    if (!subjectId) {
        alert('يرجى اختيار المادة الدراسية');
        return;
    }
    
    if (!sectionId) {
        alert('يرجى اختيار القسم');
        return;
    }

    try {
        const payload = {
            title,
            description,
            category,
            subject_id: subjectId,
            section_id: sectionId,
            video_url: videoUrl,
            google_drive_id: driveId,
            cloudinary_id: cloudinaryId,
            duration: videoDuration
        };
        
        // Only update thumbnail if we generated/fetched a new one
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

    const subjectId = document.getElementById('subject')?.value;
    const sectionId = document.getElementById('section')?.value;
    
    if (!subjectId) {
        alert('يرجى اختيار المادة الدراسية');
        return;
    }
    
    if (!sectionId) {
        alert('يرجى اختيار القسم');
        return;
    }

    try {
        const payload = {
            title,
            description,
            file_type: fileType,
            subject_id: subjectId,
            section_id: sectionId,
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
    const subjectId = document.getElementById('subject')?.value;
    const sectionId = document.getElementById('section')?.value;
    
    if (!subjectId) {
        alert('يرجى اختيار المادة الدراسية');
        return;
    }
    
    if (!sectionId) {
        alert('يرجى اختيار القسم');
        return;
    }

    try {
        let quizId = editingId;
        const quizPayload = {
            title,
            description,
            subject_id: subjectId,
            section_id: sectionId,
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
