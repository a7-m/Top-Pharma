/**
 * Admin Announcements Management
 */

let currentEditId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await requireAuth();
    if (!isAuth) return;
    
    const isAdmin = await requireAdmin();
    if (!isAdmin) return;
    
    await loadAnnouncements();
    
    // Add announcement button
    document.getElementById('addAnnouncementBtn').addEventListener('click', () => {
        openModal();
    });
    
    // Form submit
    document.getElementById('announcementForm').addEventListener('submit', handleSubmit);
});

async function loadAnnouncements() {
    const loadingMsg = document.getElementById('loadingMessage');
    const table = document.getElementById('announcementsTable');
    const noData = document.getElementById('noData');
    const tbody = document.getElementById('announcementsTableBody');
    
    try {
        const { data, error } = await supabaseClient
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        loadingMsg.style.display = 'none';
        
        if (!data || data.length === 0) {
            noData.style.display = 'block';
            table.style.display = 'none';
            return;
        }
        
        tbody.innerHTML = data.map(announcement => `
            <tr>
                <td><strong>${announcement.title_ar}</strong></td>
                <td><span class="badge badge-${announcement.type}">${getTypeLabel(announcement.type)}</span></td>
                <td>
                    <span class="status-pill ${announcement.is_active ? 'success' : 'neutral'}">
                        ${announcement.is_active ? 'نشط' : 'غير نشط'}
                    </span>
                </td>
                <td>${formatDate(announcement.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="editAnnouncement('${announcement.id}')">تعديل</button>
                    <button class="btn btn-sm btn-outline" onclick="toggleStatus('${announcement.id}', ${!announcement.is_active})">
                        ${announcement.is_active ? 'إلغاء التفعيل' : 'تفعيل'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${announcement.id}')">حذف</button>
                </td>
            </tr>
        `).join('');
        
        table.style.display = 'block';
        noData.style.display = 'none';
        
    } catch (error) {
        console.error('Error loading announcements:', error);
        showError('فشل تحميل الإعلانات');
        loadingMsg.style.display = 'none';
    }
}

function getTypeLabel(type) {
    const labels = {
        'info': 'معلومة',
        'warning': 'تحذير',
        'success': 'نجاح',
        'error': 'خطأ'
    };
    return labels[type] || type;
}

function openModal(announcement = null) {
    const modal = document.getElementById('announcementModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('announcementForm');
    
    if (announcement) {
        modalTitle.textContent = 'تعديل الإعلان';
        document.getElementById('announcementId').value = announcement.id;
        document.getElementById('titleInput').value = announcement.title_ar;
        document.getElementById('contentInput').value = announcement.content_ar;
        document.getElementById('typeInput').value = announcement.type;
        document.getElementById('isActiveInput').checked = announcement.is_active;
        currentEditId = announcement.id;
    } else {
        modalTitle.textContent = 'إضافة إعلان جديد';
        form.reset();
        document.getElementById('announcementId').value = '';
        document.getElementById('isActiveInput').checked = true;
        currentEditId = null;
    }
    
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('announcementModal').style.display = 'none';
    document.getElementById('announcementForm').reset();
    currentEditId = null;
}

async function handleSubmit(e) {
    e.preventDefault();
    
    const announcementData = {
        title_ar: document.getElementById('titleInput').value.trim(),
        content_ar: document.getElementById('contentInput').value.trim(),
        type: document.getElementById('typeInput').value,
        is_active: document.getElementById('isActiveInput').checked
    };
    
    try {
        if (currentEditId) {
            // Update existing
            const { error } = await supabaseClient
                .from('announcements')
                .update(announcementData)
                .eq('id', currentEditId);
            
            if (error) throw error;
            showSuccess('تم تحديث الإعلان بنجاح');
        } else {
            // Create new
            const { error } = await supabaseClient
                .from('announcements')
                .insert([announcementData]);
            
            if (error) throw error;
            showSuccess('تم إضافة الإعلان بنجاح');
        }
        
        closeModal();
        await loadAnnouncements();
        
    } catch (error) {
        console.error('Error saving announcement:', error);
        showError('فشل حفظ الإعلان');
    }
}

async function editAnnouncement(id) {
    try {
        const { data, error } = await supabaseClient
            .from('announcements')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        openModal(data);
        
    } catch (error) {
        console.error('Error loading announcement:', error);
        showError('فشل تحميل بيانات الإعلان');
    }
}

async function toggleStatus(id, newStatus) {
    try {
        const { error } = await supabaseClient
            .from('announcements')
            .update({ is_active: newStatus })
            .eq('id', id);
        
        if (error) throw error;
        showSuccess(newStatus ? 'تم تفعيل الإعلان' : 'تم إلغاء تفعيل الإعلان');
        await loadAnnouncements();
        
    } catch (error) {
        console.error('Error toggling status:', error);
        showError('فشل تغيير حالة الإعلان');
    }
}

async function deleteAnnouncement(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الإعلان؟')) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('announcements')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        showSuccess('تم حذف الإعلان بنجاح');
        await loadAnnouncements();
        
    } catch (error) {
        console.error('Error deleting announcement:', error);
        showError('فشل حذف الإعلان');
    }
}
