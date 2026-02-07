// Videos Service

/**
 * Get all videos
 */
async function getAllVideos() {
    try {
        const { data, error } = await supabaseClient
            .from('videos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching videos:', error);
        showError('حدث خطأ أثناء تحميل الفيديوهات');
        return [];
    }
}

/**
 * Get videos by category
 */
async function getVideosByCategory(category) {
    try {
        const { data, error } = await supabaseClient
            .from('videos')
            .select('*')
            .eq('category', category)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching videos by category:', error);
        return [];
    }
}

/**
 * Get single video by ID
 */
async function getVideoById(videoId) {
    try {
        const { data, error } = await supabaseClient
            .from('videos')
            .select('*')
            .eq('id', videoId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching video:', error);
        return null;
    }
}

/**
 * Get video URL from storage
 */
function getVideoUrl(videoPath) {
    if (videoPath.startsWith('http')) {
        return videoPath;
    }
    const { data } = supabaseClient
        .storage
        .from('videos')
        .getPublicUrl(videoPath);
    
    return data.publicUrl;
}

/**
 * Render video cards
 */
function renderVideoCards(videos, containerId, isAdmin = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (videos.length === 0) {
        container.innerHTML = '<p class="no-data">لا توجد فيديوهات متاحة حاليًا</p>';
        return;
    }

    container.innerHTML = videos.map(video => `
        <div class="video-card">
            <div class="video-thumbnail" data-video-id="${video.id}" data-subject-id="${video.subject_id || ''}" data-section-id="${video.section_id || ''}">
                ${video.thumbnail_url 
                    ? `<img src="${video.thumbnail_url}" alt="${video.title}">`
                    : '<div class="thumbnail-placeholder"><i class="icon">🎥</i></div>'
                }
                ${video.duration ? `<span class="video-duration">${formatDuration(video.duration)}</span>` : ''}
            </div>
            <div class="video-info">
                <h3>${video.title}</h3>
                <p>${video.description || ''}</p>
                <div class="video-meta">
                    <span class="category-badge category-${video.category}">${getCategoryName(video.category)}</span>
                    <span class="video-date">${formatDate(video.created_at)}</span>
                </div>
                ${isAdmin ? `
                <div class="card-actions" style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; display: flex; gap: 10px;">
                    <button class="btn btn-sm btn-info" onclick="window.location.href='admin/add-video.html?id=${video.id}'">تعديل</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteVideo('${video.id}')">حذف</button>
                </div>
                ` : ''}
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.video-thumbnail').forEach(thumbnail => {
        thumbnail.addEventListener('click', async () => {
            const videoId = thumbnail.dataset.videoId;
            const subjectId = thumbnail.dataset.subjectId || null;
            const sectionId = thumbnail.dataset.sectionId || null;
            
            const nextUrl = `video-player.html?id=${videoId}${subjectId ? `&subject=${subjectId}` : ''}`;
            
            // Check section access if sectionId exists
            if (sectionId) {
                const canAccess = await requireSectionAccess(sectionId, nextUrl);
                if (!canAccess) return;
            } else if (subjectId) {
                // Fallback to subject access if no section ID (legacy support)
                const canAccess = await requireSubjectAccess(subjectId, nextUrl);
                if (!canAccess) return;
            }
            
            window.location.href = nextUrl;
        });
    });
}

/**
 * Get category name in Arabic
 */
function getCategoryName(category) {
    const categories = {
        'lecture': 'محاضرة',
        'review': 'مراجعة',
        'application': 'تطبيق'
    };
    return categories[category] || category;
}

/**
 * Filter videos by category
 */
function filterVideosByCategory(videos, category) {
    if (category === 'all') return videos;
    return videos.filter(video => video.category === category);
}

/**
 * Delete video
 */
async function deleteVideo(videoId) {
    if (!confirm('هل أنت متأكد من حذف هذا الفيديو؟')) return;
    
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            alert('يجب تسجيل الدخول أولاً');
            return;
        }

        // Call backend API to delete from Cloudinary and Supabase
        const response = await fetch(`${BACKEND_URL}/api/admin/delete-video`, {
            method: 'POST', // Using POST as defined in backend
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ videoId })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'فشل حذف الفيديو');
        }
        
        alert('تم حذف الفيديو بنجاح');
        window.location.reload();
    } catch (error) {
        console.error('Error deleting video:', error);
        alert('حدث خطأ أثناء الحذف: ' + error.message);
    }
}
