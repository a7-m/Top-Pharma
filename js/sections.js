/**
 * Sections Management Module
 * Handles all operations related to subject sections
 */

/**
 * Get all sections for a specific subject
 * @param {string} subjectId - Subject UUID
 * @returns {Promise<Array>} Array of section objects
 */
async function getSubjectSections(subjectId) {
    try {
        const { data, error } = await supabaseClient
            .from('subject_sections')
            .select('*')
            .eq('subject_id', subjectId)
            .order('section_order', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching sections:', error);
        throw error;
    }
}

/**
 * Get all sections
 * @returns {Promise<Array>} Array of all section objects
 */
async function getAllSections() {
    try {
        const { data, error } = await supabaseClient
            .from('subject_sections')
            .select('*, subjects:subject_id(name_ar, name_en, icon)')
            .order('section_order', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching all sections:', error);
        throw error;
    }
}

/**
 * Get a single section by ID
 * @param {string} id - Section UUID
 * @returns {Promise<Object>} Section object
 */
async function getSectionById(id) {
    try {
        const { data, error } = await supabaseClient
            .from('subject_sections')
            .select('*, subjects:subject_id(name_ar, name_en, icon)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching section:', error);
        throw error;
    }
}

/**
 * Render section selector dropdown
 * @param {string} selectElementId - ID of the select element
 * @param {string} subjectId - Subject ID to filter sections (optional)
 * @param {string} selectedId - Currently selected section ID (optional)
 * @param {boolean} required - Whether field is required (default: true)
 */
async function renderSectionSelector(selectElementId, subjectId = null, selectedId = null, required = true) {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) {
        console.error(`Select element with ID '${selectElementId}' not found`);
        return;
    }

    try {
        const sections = subjectId 
            ? await getSubjectSections(subjectId)
            : await getAllSections();

        // Clear existing options
        selectElement.innerHTML = '';

        // Add default option
        if (!required) {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'جميع الأقسام';
            selectElement.appendChild(defaultOption);
        } else {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'اختر القسم...';
            defaultOption.disabled = true;
            defaultOption.selected = !selectedId;
            selectElement.appendChild(defaultOption);
        }

        // Add section options
        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section.id;
            option.textContent = section.name_ar;
            if (selectedId && section.id === selectedId) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });

        return sections;
    } catch (error) {
        console.error('Error rendering section selector:', error);
        showError('حدث خطأ أثناء تحميل الأقسام');
    }
}

/**
 * Render section cards for a subject
 * @param {string} containerId - Container element ID
 * @param {string} subjectId - Subject UUID
 */
async function renderSectionCards(containerId, subjectId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID '${containerId}' not found`);
        return;
    }

    try {
        const sections = await getSubjectSections(subjectId);

        // Define colors for sections
        const colors = ['#3498db', '#2ecc71', '#9b59b6', '#e74c3c'];

        container.innerHTML = sections.map((section, index) => {
            const priceLabel = section.price_egp === 0 ? 'مجاني' : `${section.price_egp} جنيه`;
            return `
                <div class="section-card" 
                     data-section-id="${section.id}"
                     style="--section-color: ${colors[index % colors.length]}">
                    <div class="section-number">${section.section_order}</div>
                    <h4>${section.name_ar}</h4>
                    <p class="section-name-en">${section.name_en}</p>
                    <p class="section-description">${section.description || ''}</p>
                    <div class="section-price">${priceLabel}</div>
                    <button class="btn btn-primary section-btn" data-section-id="${section.id}">
                        الدخول للقسم
                    </button>
                </div>
            `;
        }).join('');

        // Add event listeners for the button and the card itself
        container.querySelectorAll('.section-card').forEach(card => {
            card.style.cursor = 'pointer';
            
            const handleAccess = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const sectionId = card.dataset.sectionId;
                const nextUrl = `videos.html?section=${sectionId}`;
                
                // requireSectionAccess will handle the redirect to payment if needed
                const hasAccess = await requireSectionAccess(sectionId, nextUrl);
                
                // If hasAccess is true, it means the user has access and wasn't redirected
                if (hasAccess) {
                    window.location.href = nextUrl;
                }
            };

            card.addEventListener('click', handleAccess);
            
            const btn = card.querySelector('.section-btn');
            if (btn) {
                btn.addEventListener('click', handleAccess);
            }
        });

        return sections;
    } catch (error) {
        console.error('Error rendering section cards:', error);
        showError('حدث خطأ أثناء تحميل الأقسام');
    }
}

/**
 * Render section filter tabs
 * @param {string} containerId - Container element ID
 * @param {string} subjectId - Subject ID to filter sections
 * @param {Function} onFilterChange - Callback function when filter changes
 */
async function renderSectionFilterTabs(containerId, subjectId, onFilterChange) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID '${containerId}' not found`);
        return;
    }

    try {
        const sections = await getSubjectSections(subjectId);

        // Create "All" tab
        let html = `
            <button class="filter-tab active" data-section-id="all">
                الكل
            </button>
        `;

        // Create tab for each section
        sections.forEach(section => {
            html += `
                <button class="filter-tab" data-section-id="${section.id}">
                    ${section.name_ar}
                </button>
            `;
        });

        container.innerHTML = html;

        // Add event listeners
        container.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', async () => {
                const sectionId = tab.dataset.sectionId;
                
                if (sectionId !== 'all') {
                    const status = await getSectionAccessStatus(sectionId);
                    if (!status.hasAccess) {
                        const nextUrl = new URL(window.location.href);
                        nextUrl.searchParams.set('section', sectionId);
                        const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
                        window.location.href = buildSectionPaymentUrl(sectionId, nextPath);
                        return;
                    }
                }

                // Update active state
                container.querySelectorAll('.filter-tab').forEach(t => 
                    t.classList.remove('active')
                );
                tab.classList.add('active');

                // Call callback
                if (onFilterChange) {
                    onFilterChange(sectionId === 'all' ? null : sectionId);
                }
            });
        });

        return sections;
    } catch (error) {
        console.error('Error rendering section filter tabs:', error);
        showError('حدث خطأ أثناء تحميل الأقسام');
    }
}

/**
 * Get section ID from URL parameter
 * @returns {string|null} Section ID or null
 */
function getSectionFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('section');
}

/**
 * Filter items by section
 * @param {Array} items - Array of items (videos/quizzes/files)
 * @param {string} sectionId - Section ID to filter by (null for all)
 * @returns {Array} Filtered items
 */
function filterBySection(items, sectionId) {
    if (!sectionId || sectionId === 'all') {
        return items;
    }
    return items.filter(item => item.section_id === sectionId);
}

/**
 * Create a new section
 * @param {Object} sectionData - Section data object
 * @returns {Promise<Object>} Created section
 */
async function createSection(sectionData) {
    try {
        const { data, error } = await supabaseClient
            .from('subject_sections')
            .insert(sectionData)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creating section:', error);
        throw error;
    }
}

/**
 * Update a section
 * @param {string} id - Section UUID
 * @param {Object} updates - Object with fields to update
 * @returns {Promise<Object>} Updated section
 */
async function updateSection(id, updates) {
    try {
        const { data, error } = await supabaseClient
            .from('subject_sections')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error updating section:', error);
        throw error;
    }
}

/**
 * Delete a section
 * @param {string} id - Section UUID
 * @returns {Promise<void>}
 */
async function deleteSection(id) {
    try {
        const { error } = await supabaseClient
            .from('subject_sections')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    } catch (error) {
        console.error('Error deleting section:', error);
        throw error;
    }
}
