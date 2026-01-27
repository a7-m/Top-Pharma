// Student Management (Admin)

let studentsCache = [];
let subjectsCache = [];
let subjectAccessMap = new Map();
let selectedStudentId = null;
let lastSeenMap = new Map();

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('studentsTableBody');
    if (!tableBody) return;

    initializeStudentsPage();
});

async function initializeStudentsPage() {
    setTableMessage('جاري التحميل...');

    await loadSubjects();
    await loadStudents();
    await loadLastSeen();
    await loadSubjectAccess();

    renderSubjectFilters();
    renderStudentsTable();
    updateStudentStats();
    attachStudentEvents();
}

function attachStudentEvents() {
    const searchInput = document.getElementById('studentSearch');
    const subjectFilter = document.getElementById('subjectFilter');
    const grantAccessForm = document.getElementById('grantAccessForm');
    const saveRoleBtn = document.getElementById('saveRoleBtn');
    const deleteStudentBtn = document.getElementById('deleteStudentBtn');

    if (searchInput) {
        searchInput.addEventListener('input', () => renderStudentsTable());
    }

    if (subjectFilter) {
        subjectFilter.addEventListener('change', () => renderStudentsTable());
    }

    if (grantAccessForm) {
        grantAccessForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!selectedStudentId) {
                setInlineMessage('detailsMessage', 'يرجى اختيار طالب أولاً.', 'danger');
                return;
            }
            const select = document.getElementById('grantSubjectSelect');
            const subjectId = select?.value;
            if (!subjectId) {
                setInlineMessage('detailsMessage', 'يرجى اختيار مادة للتفعيل.', 'danger');
                return;
            }
            await grantSubjectAccess(selectedStudentId, subjectId);
        });
    }

    if (saveRoleBtn) {
        saveRoleBtn.addEventListener('click', async () => {
            if (!selectedStudentId) {
                setInlineMessage('roleMessage', 'يرجى اختيار طالب أولاً.', 'danger');
                return;
            }
            const roleSelect = document.getElementById('roleSelect');
            const newRole = roleSelect?.value || 'student';
            await updateStudentRole(selectedStudentId, newRole);
        });
    }

    if (deleteStudentBtn) {
        deleteStudentBtn.addEventListener('click', async () => {
            if (!selectedStudentId) {
                setInlineMessage('deleteMessage', 'يرجى اختيار طالب أولاً.', 'danger');
                return;
            }
            await deleteStudentAccount(selectedStudentId);
        });
    }
}

async function loadSubjects() {
    try {
        subjectsCache = await getAllSubjects();
    } catch (error) {
        console.error('Error loading subjects:', error);
        subjectsCache = [];
        showError('تعذر تحميل المواد الدراسية');
    }
}

async function loadStudents() {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name, email, phone, role, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        studentsCache = data || [];
    } catch (error) {
        console.error('Error loading students:', error);
        studentsCache = [];
        setTableMessage('تعذر تحميل بيانات الطلاب.');
        showError('حدث خطأ أثناء تحميل بيانات الطلاب');
    }
}

async function loadLastSeen() {
    lastSeenMap = new Map();

    if (!studentsCache.length) return;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch('/api/admin/last-seen', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ userIds: studentsCache.map(student => student.id) })
        });

        if (!response.ok) {
            console.warn('Failed to load last seen data');
            return;
        }

        const payload = await response.json();
        const lastSeen = payload?.lastSeen || {};
        Object.entries(lastSeen).forEach(([userId, value]) => {
            if (value) {
                lastSeenMap.set(userId, value);
            }
        });
    } catch (error) {
        console.warn('Error loading last seen data:', error);
    }
}

async function loadSubjectAccess() {
    try {
        const { data, error } = await supabaseClient
            .from('subject_access')
            .select('id, user_id, subject_id, activated_at');

        if (error) throw error;
        subjectAccessMap = buildAccessMap(data || []);
    } catch (error) {
        console.error('Error loading subject access:', error);
        subjectAccessMap = new Map();
    }
}

function buildAccessMap(accessRows) {
    const map = new Map();
    accessRows.forEach((row) => {
        if (!map.has(row.user_id)) {
            map.set(row.user_id, []);
        }
        map.get(row.user_id).push(row);
    });
    return map;
}

function renderSubjectFilters() {
    const subjectFilter = document.getElementById('subjectFilter');
    const grantSelect = document.getElementById('grantSubjectSelect');

    if (subjectFilter) {
        if (subjectsCache.length === 0) {
            subjectFilter.innerHTML = '<option value="">لا توجد مواد</option>';
        } else {
            subjectFilter.innerHTML = `
                <option value="">كل المواد</option>
                ${subjectsCache.map(subject => `
                    <option value="${subject.id}">${subject.icon || '📚'} ${subject.name_ar}</option>
                `).join('')}
            `;
        }
    }

    if (grantSelect) {
        if (subjectsCache.length === 0) {
            grantSelect.innerHTML = '<option value="">لا توجد مواد</option>';
        } else {
            grantSelect.innerHTML = subjectsCache.map(subject => `
                <option value="${subject.id}">${subject.icon || '📚'} ${subject.name_ar}</option>
            `).join('');
        }
    }
}

function getFilteredStudents() {
    const searchTerm = document.getElementById('studentSearch')?.value.trim().toLowerCase() || '';
    const subjectFilter = document.getElementById('subjectFilter')?.value || '';

    return studentsCache.filter(student => {
        const fullName = (student.full_name || '').toLowerCase();
        const email = (student.email || '').toLowerCase();
        const phone = (student.phone || '').toLowerCase();
        const matchesSearch = !searchTerm || fullName.includes(searchTerm) || email.includes(searchTerm) || phone.includes(searchTerm);

        if (!matchesSearch) return false;

        if (!subjectFilter) return true;
        const accessList = subjectAccessMap.get(student.id) || [];
        return accessList.some(access => access.subject_id === subjectFilter);
    });
}

function renderStudentsTable(students = getFilteredStudents()) {
    const tableBody = document.getElementById('studentsTableBody');
    if (!tableBody) return;

    if (students.length === 0) {
        setTableMessage('لا توجد نتائج مطابقة.');
        return;
    }

    tableBody.innerHTML = students.map(student => {
        const accessList = subjectAccessMap.get(student.id) || [];
        const subjectPreview = renderSubjectPreview(accessList);
        const roleMeta = formatRole(student.role);
        const createdAt = student.created_at ? formatDate(student.created_at) : '-';
        const lastSeen = lastSeenMap.get(student.id);
        const lastLogin = lastSeen ? formatDateTime(lastSeen) : 'غير متاح';
        const rowClass = student.id === selectedStudentId ? 'is-selected' : '';

        return `
            <tr class="student-row ${rowClass}" data-student-id="${student.id}">
                <td>
                    <div class="student-name">${student.full_name || 'بدون اسم'}</div>
                    <div class="text-muted" style="font-size: 0.85rem;">${student.email || '-'}</div>
                </td>
                <td>${student.phone || '-'}</td>
                <td><span class="status-pill ${roleMeta.className}">${roleMeta.label}</span></td>
                <td>${subjectPreview}</td>
                <td>${createdAt}</td>
                <td>${lastLogin}</td>
            </tr>
        `;
    }).join('');

    tableBody.querySelectorAll('.student-row').forEach(row => {
        row.addEventListener('click', () => {
            selectStudent(row.dataset.studentId);
        });
    });
}

function renderSubjectPreview(accessList) {
    if (!accessList.length) {
        return '<span class="text-muted">بدون مواد</span>';
    }

    const preview = accessList.slice(0, 2).map(access => {
        const label = getSubjectLabel(access.subject_id);
        return `<span class="subject-chip small">${label}</span>`;
    }).join('');

    const remaining = accessList.length - 2;
    const moreLabel = remaining > 0 ? `<span class="text-muted">+${remaining}</span>` : '';

    return `<div class="subject-chip-list compact">${preview}${moreLabel}</div>`;
}

function selectStudent(studentId) {
    selectedStudentId = studentId;
    renderStudentsTable();
    renderStudentDetails();
}

function renderStudentDetails() {
    const details = document.getElementById('studentDetails');
    const emptyState = document.getElementById('studentDetailsEmpty');

    if (!details || !emptyState) return;

    const student = studentsCache.find(item => item.id === selectedStudentId);
    if (!student) {
        details.hidden = true;
        emptyState.hidden = false;
        return;
    }

    const accessList = subjectAccessMap.get(student.id) || [];
    const roleMeta = formatRole(student.role);

    emptyState.hidden = true;
    details.hidden = false;

    document.getElementById('detailName').textContent = student.full_name || 'بدون اسم';
    document.getElementById('detailEmail').textContent = student.email || '-';
    const roleEl = document.getElementById('detailRole');
    roleEl.textContent = roleMeta.label;
    roleEl.className = `status-pill ${roleMeta.className}`;

    document.getElementById('detailCreated').textContent = student.created_at ? formatDate(student.created_at) : '-';
    const lastLoginEl = document.getElementById('detailLastLogin');
    if (lastLoginEl) {
        const lastSeen = lastSeenMap.get(student.id);
        lastLoginEl.textContent = lastSeen ? formatDateTime(lastSeen) : 'غير متاح';
    }
    const phoneEl = document.getElementById('detailPhone');
    if (phoneEl) {
        phoneEl.textContent = student.phone || '-';
    }
    document.getElementById('detailSubjectCount').textContent = accessList.length;

    const roleSelect = document.getElementById('roleSelect');
    if (roleSelect) {
        roleSelect.value = student.role || 'student';
    }

    renderStudentSubjects(accessList);
    updateGrantSelect(accessList);

    setInlineMessage('detailsMessage', '');
    setInlineMessage('roleMessage', '');
    setInlineMessage('deleteMessage', '');
}

function renderStudentSubjects(accessList) {
    const container = document.getElementById('detailSubjects');
    if (!container) return;

    if (!accessList.length) {
        container.innerHTML = '<span class="text-muted">لا توجد مواد مفعلة حالياً.</span>';
        return;
    }

    container.innerHTML = accessList.map(access => {
        const label = getSubjectLabel(access.subject_id);
        return `
            <div class="subject-chip" data-subject-id="${access.subject_id}">
                <span>${label}</span>
                <button type="button" class="subject-chip-remove" title="إزالة المادة">✕</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.subject-chip-remove').forEach(button => {
        button.addEventListener('click', async (event) => {
            const subjectId = event.target.closest('.subject-chip')?.dataset.subjectId;
            if (!subjectId || !selectedStudentId) return;
            await revokeSubjectAccess(selectedStudentId, subjectId);
        });
    });
}

function updateGrantSelect(accessList) {
    const select = document.getElementById('grantSubjectSelect');
    if (!select) return;

    const activeSet = new Set(accessList.map(access => access.subject_id));

    if (subjectsCache.length === 0) {
        select.innerHTML = '<option value="">لا توجد مواد</option>';
        return;
    }

    select.innerHTML = subjectsCache.map(subject => {
        const isActive = activeSet.has(subject.id);
        return `
            <option value="${subject.id}" ${isActive ? 'disabled' : ''}>
                ${subject.icon || '📚'} ${subject.name_ar}${isActive ? ' (مفعلة)' : ''}
            </option>
        `;
    }).join('');

    const firstAvailable = Array.from(select.options).find(option => !option.disabled);
    if (firstAvailable) {
        select.value = firstAvailable.value;
    }
}

function updateStudentStats() {
    const totalEl = document.getElementById('studentsCount');
    const activeEl = document.getElementById('activeStudentsCount');

    if (totalEl) {
        const total = studentsCache.length;
        totalEl.textContent = `${total} طالب`;
    }

    if (activeEl) {
        const activeCount = studentsCache.filter(student => {
            const accessList = subjectAccessMap.get(student.id) || [];
            return accessList.length > 0;
        }).length;
        activeEl.textContent = `${activeCount} مشترك`;
    }
}

async function grantSubjectAccess(studentId, subjectId) {
    setInlineMessage('detailsMessage', 'جاري التفعيل...', 'info');

    try {
        const { error } = await supabaseClient
            .from('subject_access')
            .insert({ user_id: studentId, subject_id: subjectId });

        if (error) throw error;

        setInlineMessage('detailsMessage', 'تم تفعيل المادة بنجاح.', 'success');
        await refreshAccessData();
    } catch (error) {
        console.error('Error granting access:', error);
        setInlineMessage('detailsMessage', 'تعذر تفعيل المادة. ربما مفعلة بالفعل.', 'danger');
    }
}

async function revokeSubjectAccess(studentId, subjectId) {
    if (!confirm('هل تريد إزالة هذه المادة من الطالب؟')) return;

    setInlineMessage('detailsMessage', 'جاري إزالة المادة...', 'info');

    try {
        const { error } = await supabaseClient
            .from('subject_access')
            .delete()
            .eq('user_id', studentId)
            .eq('subject_id', subjectId);

        if (error) throw error;

        setInlineMessage('detailsMessage', 'تمت إزالة المادة بنجاح.', 'success');
        await refreshAccessData();
    } catch (error) {
        console.error('Error revoking access:', error);
        setInlineMessage('detailsMessage', 'تعذر إزالة المادة حالياً.', 'danger');
    }
}

async function updateStudentRole(studentId, newRole) {
    setInlineMessage('roleMessage', 'جاري حفظ الدور...', 'info');

    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ role: newRole })
            .eq('id', studentId);

        if (error) throw error;

        const student = studentsCache.find(item => item.id === studentId);
        if (student) {
            student.role = newRole;
        }

        setInlineMessage('roleMessage', 'تم تحديث الدور بنجاح.', 'success');
        renderStudentsTable();
        renderStudentDetails();
    } catch (error) {
        console.error('Error updating role:', error);
        setInlineMessage('roleMessage', 'تعذر تحديث الدور. تحقق من الصلاحيات.', 'danger');
    }
}

async function refreshAccessData() {
    await loadSubjectAccess();
    renderStudentsTable();
    renderStudentDetails();
    updateStudentStats();
}

function getSubjectLabel(subjectId) {
    const subject = subjectsCache.find(item => item.id === subjectId);
    if (!subject) return 'مادة';
    return `${subject.icon || '📚'} ${subject.name_ar}`;
}

function formatRole(role) {
    if (role === 'admin') {
        return { label: 'مشرف', className: 'warning' };
    }
    return { label: 'طالب', className: 'neutral' };
}

function setInlineMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (!message) {
        element.textContent = '';
        element.className = 'mt-2 text-center';
        return;
    }

    const typeClass = type === 'success' ? 'text-success' : type === 'danger' ? 'text-danger' : 'text-info';
    element.textContent = message;
    element.className = `mt-2 text-center ${typeClass}`;
}

function setTableMessage(message) {
    const tableBody = document.getElementById('studentsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center">${message}</td>
        </tr>
    `;
}

async function deleteStudentAccount(studentId) {
    if (!confirm('هل أنت متأكد من حذف الحساب نهائياً؟')) return;

    setInlineMessage('deleteMessage', 'جاري حذف الحساب...', 'info');

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
            throw new Error('يرجى تسجيل الدخول مجدداً ثم المحاولة.');
        }

        const response = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ userId: studentId })
        });

        if (!response.ok) {
            let errorMessage = 'تعذر حذف الحساب.';
            try {
                const payload = await response.json();
                if (payload?.error) errorMessage = payload.error;
            } catch (parseError) {
                console.warn('Failed to parse delete response', parseError);
            }
            throw new Error(errorMessage);
        }

        studentsCache = studentsCache.filter(student => student.id !== studentId);
        subjectAccessMap.delete(studentId);
        selectedStudentId = null;

        renderStudentsTable();
        renderStudentDetails();
        updateStudentStats();

        setInlineMessage('deleteMessage', 'تم حذف الحساب بنجاح.', 'success');
    } catch (error) {
        console.error('Error deleting user:', error);
        const message = error?.message || 'تعذر حذف الحساب. تحقق من الصلاحيات.';
        setInlineMessage('deleteMessage', message, 'danger');
    }
}
