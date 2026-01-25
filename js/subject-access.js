// Subject Access Service

/**
 * Build payment page URL for a subject
 */
function buildSubjectPaymentUrl(subjectId, nextUrl = null) {
    const params = new URLSearchParams();
    params.set('subject', subjectId);
    if (nextUrl) {
        params.set('next', nextUrl);
    }
    return `subject-payment.html?${params.toString()}`;
}

/**
 * Check if the current user has access to a subject
 */
async function getSubjectAccessStatus(subjectId) {
    if (!subjectId) {
        return { hasAccess: true, reason: 'no-subject' };
    }

    const user = await getCurrentUser();
    if (!user) {
        return { hasAccess: false, reason: 'unauthenticated' };
    }

    const profile = await getUserProfile(user.id);
    if (profile && profile.role === 'admin') {
        return { hasAccess: true, reason: 'admin' };
    }

    try {
        const { data: subject, error: subjectError } = await supabaseClient
            .from('subjects')
            .select('price_egp')
            .eq('id', subjectId)
            .single();

        if (subjectError) throw subjectError;

        if (subject && Number(subject.price_egp) === 0) {
            return { hasAccess: true, reason: 'free' };
        }
    } catch (error) {
        console.error('Error checking subject price:', error);
    }

    try {
        const { data, error } = await supabaseClient
            .from('subject_access')
            .select('id')
            .eq('user_id', user.id)
            .eq('subject_id', subjectId)
            .limit(1);

        if (error) throw error;

        return { hasAccess: Array.isArray(data) && data.length > 0, reason: 'student' };
    } catch (error) {
        console.error('Error checking subject access:', error);
        return { hasAccess: false, reason: 'error' };
    }
}

/**
 * Require subject access, redirecting to payment page if needed
 */
async function requireSubjectAccess(subjectId, nextUrl = null) {
    const status = await getSubjectAccessStatus(subjectId);
    if (status.hasAccess) {
        return true;
    }

    const redirectUrl = buildSubjectPaymentUrl(subjectId, nextUrl || window.location.href);
    window.location.href = redirectUrl;
    return false;
}

/**
 * Activate subject access with a code
 */
async function activateSubjectAccess(subjectId, activationCode) {
    const code = (activationCode || '').trim();
    if (!code) {
        return { success: false, message: 'يرجى إدخال كود التفعيل' };
    }

    try {
        const { data, error } = await supabaseClient
            .rpc('activate_subject_access', { p_subject_id: subjectId, p_code: code });

        if (error) throw error;

        const result = Array.isArray(data) ? data[0] : data;
        return {
            success: Boolean(result && result.success),
            message: result?.message || 'حدث خطأ أثناء التفعيل'
        };
    } catch (error) {
        console.error('Error activating subject access:', error);
        return { success: false, message: 'تعذر تفعيل الكود حالياً' };
    }
}
