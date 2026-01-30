// Files Service

/**
 * Get all files
 */
async function getAllFiles() {
    try {
        const { data, error } = await supabaseClient
            .from('files')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching files:', error);
        showError('حدث خطأ أثناء تحميل الملفات');
        return [];
    }
}

/**
 * Get file by ID
 */
async function getFileById(fileId) {
    try {
        const { data, error } = await supabaseClient
            .from('files')
            .select('*')
            .eq('id', fileId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching file:', error);
        return null;
    }
}

/**
 * Get file download URL
 */
function getFileDownloadUrl(filePath) {
    if (filePath.startsWith('http')) {
        return filePath;
    }
    const { data } = supabaseClient
        .storage
        .from('files')
        .getPublicUrl(filePath);
    
    return data.publicUrl;
}

/**
 * Download file
 */
function downloadFile(fileUrl, fileName) {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Get file icon based on type
 */
function getFileIcon(fileType) {
    const icons = {
        'pdf': '📄',
        'doc': '📝',
        'docx': '📝',
        'ppt': '📊',
        'pptx': '📊',
        'xls': '📈',
        'xlsx': '📈',
        'image': '🖼️',
        'video': '🎥',
        'zip': '📦',
        'rar': '📦'
    };
    
    return icons[fileType] || '📎';
}

/**
 * Render file cards
 */
function renderFileCards(files, containerId, isAdmin = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (files.length === 0) {
        container.innerHTML = '<p class="no-data">لا توجد ملفات متاحة حاليًا</p>';
        return;
    }

    container.innerHTML = files.map(file => {
        const fileUrl = getFileDownloadUrl(file.file_url);
        const buttonLabel = isAdmin ? 'تحميل' : 'عرض';
        return `
            <div class="file-card">
                <div class="file-icon">
                    ${getFileIcon(file.file_type)}
                </div>
                <div class="file-info">
                    <h3>${file.title}</h3>
                    <p>${file.description || ''}</p>
                    <div class="file-meta">
                        <span class="file-type">${file.file_type.toUpperCase()}</span>
                        <span class="file-size">${formatFileSize(file.file_size || 0)}</span>
                        <span class="file-date">${formatDate(file.created_at)}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn btn-primary btn-sm file-download-btn"
                            data-file-id="${file.id}"
                            data-file-url="${fileUrl}"
                            data-file-name="${file.title}"
                            data-file-type="${file.file_type}"
                            data-subject-id="${file.subject_id || ''}"
                            data-section-id="${file.section_id || ''}">
                        ${buttonLabel}
                    </button>
                    ${isAdmin ? `
                    <div style="margin-top: 10px; display: flex; gap: 5px; justify-content: center;">
                        <button class="btn btn-sm btn-info" onclick="window.location.href='admin/add-file.html?id=${file.id}'">تعديل</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteFile('${file.id}')">حذف</button>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.file-download-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const subjectId = button.dataset.subjectId || null;
            const sectionId = button.dataset.sectionId || null;
            
            if (!isAdmin) {
                const nextUrl = `file-viewer.html?id=${button.dataset.fileId}${subjectId ? `&subject=${subjectId}` : ''}`;
                
                if (sectionId) {
                    const canAccess = await requireSectionAccess(sectionId, nextUrl);
                    if (!canAccess) return;
                } else if (subjectId) {
                    const canAccess = await requireSubjectAccess(subjectId, nextUrl);
                    if (!canAccess) return;
                }
                
                window.location.href = nextUrl;
                return;
            }
            downloadFile(button.dataset.fileUrl, button.dataset.fileName);
        });
    });
}

/**
 * Delete file
 */
async function deleteFile(fileId) {
    if (!confirm('هل أنت متأكد من حذف هذا الملف؟')) return;
    
    try {
        const { error } = await supabaseClient
            .from('files')
            .delete()
            .eq('id', fileId);
            
        if (error) throw error;
        
        alert('تم حذف الملف بنجاح');
        window.location.reload();
    } catch (error) {
        console.error('Error deleting file:', error);
        alert('حدث خطأ أثناء الحذف');
    }
}
