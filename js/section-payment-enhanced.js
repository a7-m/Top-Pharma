// Section Payment Page - Enhanced with Discount Codes and Multiple Selection
const activationForm = document.getElementById('activationForm');
const messageEl = document.getElementById('activationMessage');
let mainSectionId = null;
let mainSection = null;
let selectedSections = []; // Array of {id, name, price} objects
let appliedDiscount = null;
let allSections = [];

(async () => {
    const isAuth = await requireAuth();
    if (!isAuth) return;

    mainSectionId = getQueryParam('section');
    if (!mainSectionId) {
        showError('القسم غير محدد');
        return;
    }

    try {
        // Load all sections for selection
        allSections = await getAllSections();
        
        // Load main section
        mainSection = await getSectionById(mainSectionId);
        document.getElementById('sectionName').textContent = mainSection.name_ar;
        document.getElementById('sectionDescription').textContent = mainSection.description || '';
        updatePriceDisplays();
        document.getElementById('sectionIntro').textContent = `للوصول إلى محتوى ${mainSection.name_ar} يرجى إكمال خطوات الدفع التالية:`;
        
        // Initialize additional section dropdown
        populateSectionDropdown();
    } catch (error) {
        console.error('Error loading section:', error);
        showError('تعذر تحميل بيانات القسم');
    }
})();

function populateSectionDropdown() {
    const select = document.getElementById('additionalSectionSelect');
    select.innerHTML = '<option value="">اختر قسمًا...</option>';
    
    allSections.forEach(section => {
        // Don't include main section or already selected sections
        if (section.id === mainSectionId || selectedSections.find(s => s.id === section.id)) {
            return;
        }
        
        const option = document.createElement('option');
        option.value = section.id;
        // Check for subjects object or property to get subject name
        const subjectName = section.subjects ? section.subjects.name_ar : '';
        const displayName = subjectName ? `${subjectName} - ${section.name_ar}` : section.name_ar;
        option.textContent = `${displayName} - ${section.price_egp} جنيه`;
        select.appendChild(option);
    });
}

// Add Section Button
document.getElementById('addSectionBtn').addEventListener('click', () => {
    const modal = document.getElementById('sectionSelectionModal');
    modal.style.display = 'flex';
    populateSectionDropdown();
});

// Cancel Selection
document.getElementById('cancelSelectBtn').addEventListener('click', () => {
    document.getElementById('sectionSelectionModal').style.display = 'none';
    document.getElementById('additionalSectionSelect').value = '';
});

// Confirm  Selection
document.getElementById('confirmSelectBtn').addEventListener('click', () => {
    const select = document.getElementById('additionalSectionSelect');
    const sectionId = select.value;
    
    if (!sectionId) {
        showError('يرجى اختيار قسم');
        return;
    }
    
    const section = allSections.find(s => s.id === sectionId);
    if (!section) return;
    
    selectedSections.push({
        id: section.id,
        name: section.name_ar,
        price: section.price_egp || 0
    });
    
    updateSelectedSectionsList();
    updatePriceDisplays();
    document.getElementById('sectionSelectionModal').style.display = 'none';
    document.getElementById('additionalSectionSelect').value = '';
    populateSectionDropdown(); // Refresh to exclude newly added section
});

function updateSelectedSectionsList() {
    const container = document.getElementById('selectedSectionsContainer');
 const list = document.getElementById('selectedSectionsList');
    
    if (selectedSections.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    
    list.innerHTML = selectedSections.map((section, index) => `
        <li class="selected-section-item">
            <div class="selected-section-info">
                <div class="selected-section-name">${section.name}</div>
                <div class="selected-section-price">${section.price} جنيه</div>
            </div>
            <button type="button" class="remove-section-btn" onclick="removeSection(${index})">حذف</button>
        </li>
    `).join('');
    
    updateTotalPrice();
}

function removeSection(index) {
    selectedSections.splice(index, 1);
    updateSelectedSectionsList();
    updatePriceDisplays();
    populateSectionDropdown(); // Refresh dropdown
}

function updateTotalPrice() {
    const total = selectedSections.reduce((sum, s) => sum + s.price, 0);
    document.getElementById('totalPriceDisplay').textContent = `${total} جنيه`;
}

function updatePriceDisplays() {
    if (!mainSection) return;
    
    const basePrice = mainSection.price_egp || 0;
    const additionalPrice = selectedSections.reduce((sum, s) => sum + s.price, 0);
    const originalPrice = basePrice + additionalPrice;
    
    let finalPrice = originalPrice;
    
    if (appliedDiscount) {
        finalPrice = originalPrice - Math.round(originalPrice * appliedDiscount.discountPercentage / 100);
    }
    
    document.getElementById('sectionPrice').textContent = `${basePrice} جنيه`;
    document.getElementById('originalPriceDisplay').textContent = `${originalPrice} جنيه`;
    document.getElementById('finalPriceDisplay').textContent = `${finalPrice} جنيه`;
    
    // Add styling if discount applied
    if (appliedDiscount) {
        document.getElementById('originalPriceDisplay').classList.add('has-discount');
    } else {
        document.getElementById('originalPriceDisplay').classList.remove('has-discount');
    }
}

// Apply Discount Code
document.getElementById('applyDiscountBtn').addEventListener('click', async () => {
    const discountCode = document.getElementById('discountCodeInput').value.trim();
    const discountMessage = document.getElementById('discountMessage');
    
    if (!discountCode) {
        discountMessage.textContent = 'يرجى إدخال كود الخصم';
        discountMessage.className = 'mt-2 text-center text-danger';
        return;
    }
    
    discountMessage.textContent = 'جاري التحقق...';
    discountMessage.className = 'mt-2 text-center text-info';
    
    const result = await applyDiscountCode(discountCode, mainSectionId, mainSection.price_egp || 0);
    
    if (result.success) {
        appliedDiscount = {
            code: discountCode,
            discountPercentage: result.discountPercentage
        };
        discountMessage.textContent = result.message;
        discountMessage.className = 'mt-2 text-center text-success';
        updatePriceDisplays();
    } else {
        appliedDiscount = null;
        discountMessage.textContent = result.message;
        discountMessage.className = 'mt-2 text-center text-danger';
        updatePriceDisplays();
    }
});

// Activation Form Submit
activationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    messageEl.textContent = 'جاري التفعيل...';
    messageEl.className = 'mt-3 text-center text-info';

    const code = document.getElementById('activationCode').value;
    
    // If multiple sections selected, activate all of them
    const sectionsToActivate = [mainSectionId, ...selectedSections.map(s => s.id)];
    
    let allSuccess = true;
    let activatedCount = 0;
    
    for (const sectionId of sectionsToActivate) {
        const result = await activateSectionAccess(sectionId, code);
        if (result.success) {
            activatedCount++;
            
            // Generate discount code for this activation
            const user = await getCurrentUser();
            if (user) {
                await generateDiscountCodeOnActivation(user.id, sectionId);
            }
        } else {
            allSuccess = false;
            messageEl.textContent = `فشل تفعيل أحد الأقسام: ${result.message}`;
            messageEl.className = 'mt-3 text-center text-danger';
            break;
        }
    }
    
    if (allSuccess) {
        messageEl.textContent = `تم تفعيل ${activatedCount} ${activatedCount === 1 ? 'قسم' : 'أقسام'} بنجاح! 🎉`;
        messageEl.className = 'mt-3 text-center text-success';
        const nextUrl = getQueryParam('next') || `videos.html?section=${mainSectionId}`;
        setTimeout(() => {
            window.location.href = nextUrl;
        }, 1500);
    }
});
