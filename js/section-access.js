// Section Access Service

/**
 * Build payment page URL for a section
 */
function buildSectionPaymentUrl(sectionId, nextUrl = null) {
    const params = new URLSearchParams();
    params.set('section', sectionId);
    if (nextUrl) {
        params.set('next', nextUrl);
    }
    return `section-payment.html?${params.toString()}`;
}

/**
 * Check if the current user has access to a section
 */
async function getSectionAccessStatus(sectionId) {
    if (!sectionId) {
        return { hasAccess: true, reason: 'no-section' };
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
        const { data: section, error: sectionError } = await supabaseClient
            .from('subject_sections')
            .select('price_egp')
            .eq('id', sectionId)
            .single();

        if (sectionError) throw sectionError;

        if (section && Number(section.price_egp) === 0) {
            return { hasAccess: true, reason: 'free' };
        }
    } catch (error) {
        console.error('Error checking section price:', error);
    }

    try {
        const { data, error } = await supabaseClient
            .from('section_access')
            .select('id')
            .eq('user_id', user.id)
            .eq('section_id', sectionId)
            .limit(1);

        if (error) throw error;

        return { hasAccess: Array.isArray(data) && data.length > 0, reason: 'student' };
    } catch (error) {
        console.error('Error checking section access:', error);
        return { hasAccess: false, reason: 'error' };
    }
}

/**
 * Require section access, redirecting to payment page if needed
 */
async function requireSectionAccess(sectionId, nextUrl = null) {
    const status = await getSectionAccessStatus(sectionId);
    if (status.hasAccess) {
        return true;
    }

    const redirectUrl = buildSectionPaymentUrl(sectionId, nextUrl || window.location.href);
    window.location.href = redirectUrl;
    return false;
}

/**
 * Activate section access with a code
 */
async function activateSectionAccess(sectionId, activationCode) {
    const code = (activationCode || '').trim();
    if (!code) {
        return { success: false, message: 'يرجى إدخال كود التفعيل' };
    }

    try {
        const { data, error } = await supabaseClient
            .rpc('activate_section_access', { p_section_id: sectionId, p_code: code });

        if (error) throw error;

        const result = Array.isArray(data) ? data[0] : data;
        return {
            success: Boolean(result && result.success),
            message: result?.message || 'حدث خطأ أثناء التفعيل'
        };
    } catch (error) {
        console.error('Error activating section access:', error);
        return { success: false, message: 'تعذر تفعيل الكود حالياً' };
    }
}

/**
 * Get user's accessible sections
 */
async function getUserAccessibleSections() {
    try {
        const user = await getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabaseClient
            .from('section_access')
            .select('section_id, subject_sections(*)')
            .eq('user_id', user.id);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching user accessible sections:', error);
        return [];
    }
}
