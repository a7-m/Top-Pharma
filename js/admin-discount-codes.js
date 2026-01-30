/**
 * Admin Discount Codes Management
 */

let currentEditId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await requireAuth();
    if (!isAuth) return;
    
    const isAdmin = await requireAdmin();
    if (!isAdmin) return;
    
    await loadDiscountCodes();
    
    document.getElementById('addCodeBtn').addEventListener('click', () => {
        openModal();
    });
    
    document.getElementById('codeForm').addEventListener('submit', handleSubmit);
});

async function loadDiscountCodes() {
    const loadingMsg = document.getElementById('loadingMessage');
    const table = document.getElementById('codesTable');
    const noData = document.getElementById('noData');
    const tbody = document.getElementById('codesTableBody');
    
    try {
        const { data, error } = await supabaseClient
            .from('discount_codes')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        loadingMsg.style.display = 'none';
        
        if (!data || data.length === 0) {
            noData.style.display = 'block';
            table.style.display = 'none';
            return;
        }
        
        tbody.innerHTML = data.map(code => {
            const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
            const isMaxed = code.max_uses && code.used_count >= code.max_uses;
            const isActive = code.is_active && !isExpired && !isMaxed;
            
            return `
                <tr>
                    <td><strong style="font-family: monospace; font-size: 1.1em;">${code.code}</strong></td>
                    <td>${code.discount_percentage}%</td>
                    <td>${code.used_count} / ${code.max_uses || '∞'}</td>
                    <td>${code.expires_at ? formatDate(code.expires_at) : 'بدون انتهاء'}</td>
                    <td>
                        <span class="status-pill ${isActive ? 'success' : 'neutral'}">
                            ${isActive ? 'نشط' : (isExpired ? 'منتهي' : (isMaxed ? 'مكتمل' : 'غير نشط'))}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="editCode('${code.id}')">تعديل</button>
                        <button class="btn btn-sm btn-outline" onclick="viewStats('${code.id}')">إحصائيات</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCode('${code.id}')">حذف</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        table.style.display = 'block';
        noData.style.display = 'none';
        
    } catch (error) {
        console.error('Error loading discount codes:', error);
        showError('فشل تحميل أكواد الخصم');
        loadingMsg.style.display = 'none';
    }
}

function openModal(code = null) {
    const modal = document.getElementById('codeModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('codeForm');
    
    if (code) {
        modalTitle.textContent = 'تعديل كود الخصم';
        document.getElementById('codeId').value = code.id;
        document.getElementById('codeInput').value = code.code;
        document.getElementById('codeInput').readOnly = true; // Can't change code after creation
        document.getElementById('discountInput').value = code.discount_percentage;
        document.getElementById('maxUsesInput').value = code.max_uses || '';
        
        if (code.expires_at) {
            const date = new Date(code.expires_at);
            document.getElementById('expiresInput').value = date.toISOString().slice(0, 16);
        } else {
            document.getElementById('expiresInput').value = '';
        }
        
        document.getElementById('isActiveInput').checked = code.is_active;
        currentEditId = code.id;
    } else {
        modalTitle.textContent = 'إضافة كود خصم جديد';
        form.reset();
        document.getElementById('codeId').value = '';
        document.getElementById('codeInput').readOnly = false;
        document.getElementById('isActiveInput').checked = true;
        currentEditId = null;
    }
    
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('codeModal').style.display = 'none';
    document.getElementById('codeForm').reset();
    currentEditId = null;
}

async function handleSubmit(e) {
    e.preventDefault();
    
    const codeData = {
        code: document.getElementById('codeInput').value.trim().toUpperCase(),
        discount_percentage: parseInt(document.getElementById('discountInput').value),
        max_uses: document.getElementById('maxUsesInput').value ? parseInt(document.getElementById('maxUsesInput').value) : null,
        expires_at: document.getElementById('expiresInput').value || null,
        is_active: document.getElementById('isActiveInput').checked
    };
    
    try {
        if (currentEditId) {
            // Update (can't change code itself)
            const updateData = { ...codeData };
            delete updateData.code;
            
            const { error } = await supabaseClient
                .from('discount_codes')
                .update(updateData)
                .eq('id', currentEditId);
            
            if (error) throw error;
            showSuccess('تم تحديث كود الخصم بنجاح');
        } else {
            // Create new
            const { error } = await supabaseClient
                .from('discount_codes')
                .insert([codeData]);
            
            if (error) {
                if (error.code === '23505') { // Unique violation
                    throw new Error('كود الخصم موجود بالفعل');
                }
                throw error;
            }
            showSuccess('تم إضافة كود الخصم بنجاح');
        }
        
        closeModal();
        await loadDiscountCodes();
        
    } catch (error) {
        console.error('Error saving discount code:', error);
        showError(error.message || 'فشل حفظ كود الخصم');
    }
}

async function editCode(id) {
    try {
        const { data, error } = await supabaseClient
            .from('discount_codes')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        openModal(data);
        
    } catch (error) {
        console.error('Error loading code:', error);
        showError('فشل تحميل بيانات كود الخصم');
    }
}

async function viewStats(id) {
    try {
        const { data: usage, error } = await supabaseClient
            .from('user_discount_codes')
            .select(`
                *,
                profiles:user_id (full_name, email),
                sections:section_id (name_ar)
            `)
            .eq('discount_code_id', id);
        
        if (error) throw error;
        
        if (!usage || usage.length === 0) {
            alert('لم يستخدم أحد هذا الكود بعد');
            return;
        }
        
        const statsHtml = usage.map(u => `
            - ${u.profiles?.full_name || 'مستخدم'} (${u.profiles?.email}) - ${u.sections?.name_ar} - ${formatDate(u.generated_at)}
        `).join('\n');
        
        alert(`إحصائيات استخدام الكود:\n\n${statsHtml}`);
        
    } catch (error) {
        console.error('Error loading stats:', error);
        showError('فشل تحميل الإحصائيات');
    }
}

async function deleteCode(id) {
    if (!confirm('هل أنت متأكد من حذف كود الخصم؟ سيتم حذف جميع السجلات المرتبطة به.')) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('discount_codes')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        showSuccess('تم حذف كود الخصم بنجاح');
        await loadDiscountCodes();
        
    } catch (error) {
        console.error('Error deleting code:', error);
        showError('فشل حذف كود الخصم');
    }
}
