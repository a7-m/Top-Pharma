let initialProfile = null;
let initialUser = null;

document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profileForm');
    if (!profileForm) return;

    initializeProfilePage();
});

async function initializeProfilePage() {
    const isAuth = await requireAuth();
    if (!isAuth) return;

    setMessage('profileMessage', 'جاري تحميل البيانات...', 'info');

    try {
        const user = await getCurrentUser();
        if (!user) {
            throw new Error('يرجى تسجيل الدخول مرة أخرى.');
        }

        const profile = await getUserProfile(user.id);
        if (!profile) {
            throw new Error('تعذر تحميل بيانات الملف الشخصي.');
        }

        initialUser = user;
        initialProfile = profile;

        fillProfileForm(profile, user);
        attachProfileEvents();
        setMessage('profileMessage', '');
    } catch (error) {
        console.error('Error loading profile:', error);
        setMessage('profileMessage', error.message || 'تعذر تحميل البيانات.', 'danger');
    }
}

function attachProfileEvents() {
    const profileForm = document.getElementById('profileForm');
    const resetButton = document.getElementById('resetProfileBtn');
    const passwordForm = document.getElementById('passwordForm');

    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileSubmit);
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            if (initialProfile && initialUser) {
                fillProfileForm(initialProfile, initialUser);
                setMessage('profileMessage', '');
            }
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordSubmit);
    }
}

function fillProfileForm(profile, user) {
    const fullName = profile.full_name || '';
    const email = user.email || profile.email || '';
    const phone = profile.phone || '';

    const roleMeta = getRoleMeta(profile.role);
    const createdAt = profile.created_at ? formatDate(profile.created_at) : '-';
    const updatedAt = profile.updated_at ? formatDateTime(profile.updated_at) : createdAt;

    const fullNameInput = document.getElementById('profileFullName');
    const phoneInput = document.getElementById('profilePhone');
    const emailInput = document.getElementById('profileEmail');
    const roleInput = document.getElementById('profileRoleInput');
    const createdInput = document.getElementById('profileCreatedInput');

    if (fullNameInput) fullNameInput.value = fullName;
    if (phoneInput) phoneInput.value = phone;
    if (emailInput) emailInput.value = email;
    if (roleInput) roleInput.value = roleMeta.label;
    if (createdInput) createdInput.value = createdAt;

    const summaryName = document.getElementById('summaryName');
    const summaryEmail = document.getElementById('summaryEmail');
    const summaryPhone = document.getElementById('summaryPhone');
    const summaryRole = document.getElementById('summaryRole');
    const summaryRoleBadge = document.getElementById('summaryRoleBadge');
    const summaryCreated = document.getElementById('summaryCreated');
    const summaryUpdated = document.getElementById('summaryUpdated');
    const summaryCreatedShort = document.getElementById('summaryCreatedShort');
    const summaryAvatar = document.getElementById('summaryAvatar');

    if (summaryName) summaryName.textContent = fullName || '-';
    if (summaryEmail) summaryEmail.textContent = email || '-';
    if (summaryPhone) summaryPhone.textContent = phone || '-';
    if (summaryCreated) summaryCreated.textContent = createdAt;
    if (summaryUpdated) summaryUpdated.textContent = updatedAt;
    if (summaryCreatedShort) summaryCreatedShort.textContent = createdAt;

    if (summaryRole) {
        summaryRole.textContent = roleMeta.label;
        summaryRole.className = `status-pill ${roleMeta.className}`;
    }

    if (summaryRoleBadge) {
        summaryRoleBadge.textContent = roleMeta.label;
        summaryRoleBadge.className = `status-pill ${roleMeta.className}`;
    }

    if (summaryAvatar) {
        summaryAvatar.textContent = getInitials(fullName, email);
    }
}

async function handleProfileSubmit(event) {
    event.preventDefault();
    if (!initialProfile || !initialUser) return;

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalLabel = submitBtn?.textContent || '';

    const fullName = document.getElementById('profileFullName')?.value.trim() || '';
    const email = document.getElementById('profileEmail')?.value.trim() || '';
    const phoneInput = document.getElementById('profilePhone')?.value.trim() || '';
    const normalizedPhone = phoneInput.replace(/[\s()-]/g, '');

    if (!fullName || fullName.length < 3) {
        setMessage('profileMessage', 'الاسم يجب أن يكون 3 أحرف على الأقل.', 'danger');
        return;
    }

    if (!isValidEmail(email)) {
        setMessage('profileMessage', 'البريد الإلكتروني غير صحيح.', 'danger');
        return;
    }

    if (normalizedPhone && !/^\+?\d{8,15}$/.test(normalizedPhone)) {
        setMessage('profileMessage', 'رقم الهاتف غير صحيح.', 'danger');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الحفظ...';
    }

    setMessage('profileMessage', 'جاري تحديث البيانات...', 'info');

    try {
        const profileUpdates = {};
        const metadataUpdates = {};

        if (fullName !== (initialProfile.full_name || '')) {
            profileUpdates.full_name = fullName;
            metadataUpdates.full_name = fullName;
        }

        const currentPhone = initialProfile.phone || '';
        if (normalizedPhone !== currentPhone) {
            profileUpdates.phone = normalizedPhone || null;
            metadataUpdates.phone = normalizedPhone || null;
        }

        const currentEmail = initialUser.email || initialProfile.email || '';
        const emailChanged = email !== currentEmail;
        if (emailChanged) {
            profileUpdates.email = email;
        }

        const authUpdates = {};
        if (emailChanged) authUpdates.email = email;
        if (Object.keys(metadataUpdates).length > 0) {
            authUpdates.data = metadataUpdates;
        }

        if (Object.keys(profileUpdates).length === 0 && Object.keys(authUpdates).length === 0) {
            setMessage('profileMessage', 'لا توجد تغييرات لحفظها.', 'info');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalLabel;
            }
            return;
        }

        if (Object.keys(authUpdates).length > 0) {
            const { error: authError } = await supabaseClient.auth.updateUser(authUpdates);
            if (authError) throw authError;
        }

        if (Object.keys(profileUpdates).length > 0) {
            profileUpdates.updated_at = new Date().toISOString();
            const { error } = await supabaseClient
                .from('profiles')
                .update(profileUpdates)
                .eq('id', initialProfile.id);

            if (error) throw error;
        }

        const refreshedUser = await getCurrentUser();
        const refreshedProfile = await getUserProfile(initialProfile.id);
        if (refreshedUser && refreshedProfile) {
            initialUser = refreshedUser;
            initialProfile = refreshedProfile;
            fillProfileForm(refreshedProfile, refreshedUser);
        }

        const successMessage = emailChanged
            ? 'تم تحديث بياناتك. يرجى تأكيد البريد الإلكتروني الجديد عبر الرسالة المرسلة إليك.'
            : 'تم تحديث بيانات الملف الشخصي بنجاح.';
        setMessage('profileMessage', successMessage, 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        const message = error?.message || 'تعذر تحديث البيانات حالياً.';
        setMessage('profileMessage', message, 'danger');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
        }
    }
}

async function handlePasswordSubmit(event) {
    event.preventDefault();

    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmNewPassword')?.value || '';
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalLabel = submitBtn?.textContent || '';

    if (newPassword.length < 8) {
        setMessage('passwordMessage', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.', 'danger');
        return;
    }

    if (newPassword !== confirmPassword) {
        setMessage('passwordMessage', 'كلمات المرور غير متطابقة.', 'danger');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري التحديث...';
    }

    setMessage('passwordMessage', 'جاري تحديث كلمة المرور...', 'info');

    try {
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) throw error;

        setMessage('passwordMessage', 'تم تحديث كلمة المرور بنجاح.', 'success');
        event.target.reset();
    } catch (error) {
        console.error('Error updating password:', error);
        setMessage('passwordMessage', error?.message || 'تعذر تحديث كلمة المرور حالياً.', 'danger');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
        }
    }
}

function getRoleMeta(role) {
    if (role === 'admin') {
        return { label: 'مشرف', className: 'warning' };
    }
    return { label: 'طالب', className: 'neutral' };
}

function getInitials(name, email) {
    const trimmedName = (name || '').trim();
    if (trimmedName) {
        const parts = trimmedName.split(/\s+/).filter(Boolean);
        const first = parts[0]?.charAt(0) || '';
        const second = parts.length > 1 ? parts[1]?.charAt(0) : parts[0]?.charAt(1) || '';
        const initials = `${first}${second}`.trim();
        if (initials) return initials.toUpperCase();
    }

    if (email) {
        return email.slice(0, 2).toUpperCase();
    }

    return 'TP';
}

function setMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (!message) {
        element.textContent = '';
        element.className = 'profile-message mt-2 text-center';
        return;
    }

    const typeClass = type === 'success'
        ? 'text-success'
        : type === 'danger'
            ? 'text-danger'
            : 'text-info';

    element.textContent = message;
    element.className = `profile-message mt-2 text-center ${typeClass}`;
}
