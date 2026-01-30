/**
 * Discount Codes Module
 * Handles discount code validation, application, and management
 */

/**
 * Get user's discount codes
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Array of user discount code objects
 */
async function getUserDiscountCodes(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('user_discount_codes')
            .select(`
                *,
                discount_codes:discount_code_id (
                    code,
                    discount_percentage,
                    expires_at,
                    is_active
                ),
                sections:section_id (
                    name_ar,
                    name_en
                )
            `)
            .eq('user_id', userId)
            .order('generated_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching user discount codes:', error);
        return [];
    }
}

/**
 * Validate discount code
 * @param {string} code - Discount code to validate
 * @param {string} sectionId - Section ID (optional, for future use)
 * @returns {Promise<Object>} Validation result
 */
async function validateDiscountCode(code, sectionId = null) {
    try {
        const { data, error } = await supabaseClient
            .rpc('validate_discount_code', {
                p_code: code.toUpperCase().trim(),
                p_section_id: sectionId
            });

        if (error) throw error;
        
        if (data && data.length > 0) {
            return data[0];
        }
        
        return {
            is_valid: false,
            discount_percentage: 0,
            message: 'كود الخصم غير صحيح'
        };
    } catch (error) {
        console.error('Error validating discount code:', error);
        return {
            is_valid: false,
            discount_percentage: 0,
            message: 'حدث خطأ أثناء التحقق من كود الخصم'
        };
    }
}

/**
 * Apply discount code to price
 * @param {string} code - Discount code
 * @param {string} sectionId - Section ID
 * @param {number} originalPrice - Original price in EGP
 * @returns {Promise<Object>} Result with discounted price
 */
async function applyDiscountCode(code, sectionId, originalPrice) {
    const validation = await validateDiscountCode(code, sectionId);
    
    if (!validation.is_valid) {
        return {
            success: false,
            message: validation.message,
            originalPrice: originalPrice,
            discountedPrice: originalPrice,
            discountPercentage: 0
        };
    }

    const discountAmount = Math.round(originalPrice * validation.discount_percentage / 100);
    const discountedPrice = originalPrice - discountAmount;

    return {
        success: true,
        message: `تم تطبيق خصم ${validation.discount_percentage}%`,
        originalPrice: originalPrice,
        discountedPrice: discountedPrice,
        discountPercentage: validation.discount_percentage,
        discountAmount: discountAmount
    };
}

/**
 * Generate discount code for user when they activate a section
 * @param {string} userId - User UUID
 * @param {string} sectionId - Section UUID
 * @returns {Promise<Object|null>} Generated discount code object or null
 */
async function generateDiscountCodeOnActivation(userId, sectionId) {
    try {
        const { data, error } = await supabaseClient
            .rpc('generate_discount_code_for_user', {
                p_user_id: userId,
                p_section_id: sectionId
            });

        if (error) throw error;
        
        if (data && data.length > 0) {
            return data[0];
        }
        
        return null;
    } catch (error) {
        console.error('Error generating discount code:', error);
        return null;
    }
}

/**
 * Display user discount codes in profile
 * @param {string} containerId - Container element ID
 * @param {Array} discountCodes - Array of user discount codes
 */
function renderUserDiscountCodes(containerId, discountCodes) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element with ID '${containerId}' not found`);
        return;
    }

    if (!discountCodes || discountCodes.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <p>لا توجد أكواد خصم متاحة حالياً</p>
                <p>قم بتفعيل أقسام جديدة للحصول على أكواد خصم!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = discountCodes.map(udc => {
        const dc = udc.discount_codes;
        const section = udc.sections;
        
        // Check if expired
        const isExpired = dc.expires_at && new Date(dc.expires_at) < new Date();
        const isActive = dc.is_active && !isExpired;
        
        const expiryText = dc.expires_at 
            ? `ينتهي في: ${formatDate(dc.expires_at)}`
            : 'بدون تاريخ انتهاء';
        
        const statusClass = isActive ? 'success' : 'neutral';
        const statusText = isActive ? 'نشط' : 'منتهي';
        
        return `
            <div class="discount-code-card ${!isActive ? 'expired' : ''}">
                <div class="discount-code-header">
                    <div class="discount-code-badge">${dc.code}</div>
                    <span class="status-pill ${statusClass}">${statusText}</span>
                </div>
                <div class="discount-code-body">
                    <div class="discount-code-info">
                        <strong class="discount-percentage">${dc.discount_percentage}%</strong>
                        <span class="text-muted">نسبة الخصم</span>
                    </div>
                    <div class="discount-code-details">
                        <p class="text-muted">📚 ${section.name_ar}</p>
                        <p class="text-muted">📅 ${expiryText}</p>
                        <p class="text-muted">🎁 تم الحصول عليه: ${formatDate(udc.generated_at)}</p>
                    </div>
                </div>
                ${isActive ? `
                    <button 
                        class="btn btn-outline btn-sm copy-code-btn" 
                        onclick="copyDiscountCode('${dc.code}')"
                    >
                        📋 نسخ الكود
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Copy discount code to clipboard
 * @param {string} code - Discount code to copy
 */
function copyDiscountCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showSuccess('تم نسخ كود الخصم!');
    }).catch(err => {
        console.error('Error copying code:', err);
        showError('فشل نسخ الكود');
    });
}

/**
 * Format discount code for display (add dashes every 4 characters)
 * @param {string} code - Discount code
 * @returns {string} Formatted code
 */
function formatDiscountCodeDisplay(code) {
    return code.match(/.{1,4}/g)?.join('-') || code;
}
