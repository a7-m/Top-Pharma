/**
 * Subjects Management Module
 * Handles all operations related to academic subjects
 */

/**
 * Get all subjects from database
 * @returns {Promise<Array>} Array of subject objects
 */
async function getAllSubjects() {
    try {
        const { data, error } = await supabaseClient
            .from('subjects')
            .select('*')
            .order('order', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching subjects:', error);
        throw error;
    }
}

/**
 * Get a single subject by ID
 * @param {string} id - Subject UUID
 * @returns {Promise<Object>} Subject object
 */
async function getSubjectById(id) {
    try {
        const { data, error } = await supabaseClient
            .from('subjects')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching subject:', error);
        throw error;
    }
}

/**
 * Render subject selector dropdown
 * @param {string} selectElementId - ID of the select element
 * @param {string} selectedId - Currently selected subject ID (optional)
 * @param {boolean} required - Whether field is required (default: true)
 */
async function renderSubjectSelector(selectElementId, selectedId = null, required = true) {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) {
        console.error(`Select element with ID '${selectElementId}' not found`);
        return;
    }

    try {
        const subjects = await getAllSubjects();

        // Clear existing options
        selectElement.innerHTML = '';

        // Add default option if not required
        if (!required) {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'جميع المواد';
            selectElement.appendChild(defaultOption);
        } else {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'اختر المادة الدراسية...';
            defaultOption.disabled = true;
            defaultOption.selected = !selectedId;
            selectElement.appendChild(defaultOption);
        }

        // Add subject options
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = `${subject.icon} ${subject.name_ar}`;
            if (selectedId && subject.id === selectedId) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });

        return subjects;
    } catch (error) {
        console.error('Error rendering subject selector:', error);
        showError('حدث خطأ أثناء تحميل المواد الدراسية');
    }
}

/**
 * Render subject cards for dashboard with sections
 * @param {string} containerId - Container element ID
 */
async function renderSubjectCards(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID '${containerId}' not found`);
        return;
    }

    try {
        const subjects = await getAllSubjects();

        // Define colors for each subject
        const colors = ['#2ecc71', '#3498db', '#9b59b6', '#e74c3c'];

        let html = '';
        for (let index = 0; index < subjects.length; index++) {
            const subject = subjects[index];
            const sections = await getSubjectSections(subject.id);
            
            html += `
                <div class="subject-card-container" data-subject-id="${subject.id}">
                    <div class="subject-card" 
                         style="--subject-color: ${colors[index % colors.length]}">
                        <div class="subject-icon">${subject.icon}</div>
                        <h3>${subject.name_ar}</h3>
                        <p class="subject-name-en">${subject.name_en}</p>
                        <p class="subject-description">${subject.description || ''}</p>
                        <button class="btn btn-outline view-sections-btn" data-subject-id="${subject.id}">
                            عرض الأقسام (${sections.length})
                        </button>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Add view sections event listeners (for the button and the card itself)
        container.querySelectorAll('.subject-card').forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
                const subjectId = card.parentElement.dataset.subjectId;
                window.location.href = `sections.html?subject=${subjectId}`;
            });
        });

        container.querySelectorAll('.view-sections-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const subjectId = btn.dataset.subjectId;
                window.location.href = `sections.html?subject=${subjectId}`;
            });
        });

        // Add section button event listeners
        container.querySelectorAll('.section-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sectionId = btn.dataset.sectionId;
                const status = await getSectionAccessStatus(sectionId);
                
                if (!status.hasAccess) {
                    window.location.href = buildSectionPaymentUrl(sectionId, `videos.html?section=${sectionId}`);
                    return;
                }
                
                window.location.href = `videos.html?section=${sectionId}`;
            });
        });

        return subjects;
    } catch (error) {
        console.error('Error rendering subject cards:', error);
        showError('حدث خطأ أثناء تحميل المواد الدراسية');
    }
}

/**
 * Render subject filter tabs
 * @param {string} containerId - Container element ID
 * @param {Function} onFilterChange - Callback function when filter changes
 */
async function renderSubjectFilterTabs(containerId, onFilterChange) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID '${containerId}' not found`);
        return;
    }

    try {
        const subjects = await getAllSubjects();

        // Create "All" tab
        let html = `
            <button class="filter-tab active" data-subject-id="all">
                الكل
            </button>
        `;

        // Create tab for each subject
        subjects.forEach(subject => {
            html += `
                <button class="filter-tab" data-subject-id="${subject.id}">
                    ${subject.icon} ${subject.name_ar}
                </button>
            `;
        });

        container.innerHTML = html;

        // Add event listeners
        container.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', async () => {
                const subjectId = tab.dataset.subjectId;
                if (subjectId !== 'all') {
                    const status = await getSubjectAccessStatus(subjectId);
                    if (!status.hasAccess) {
                        const nextUrl = new URL(window.location.href);
                        nextUrl.searchParams.set('subject', subjectId);
                        const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
                        window.location.href = buildSubjectPaymentUrl(subjectId, nextPath);
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
                    onFilterChange(subjectId === 'all' ? null : subjectId);
                }
            });
        });

        return subjects;
    } catch (error) {
        console.error('Error rendering subject filter tabs:', error);
        showError('حدث خطأ أثناء تحميل المواد الدراسية');
    }
}

/**
 * Get subject ID from URL parameter
 * @returns {string|null} Subject ID or null
 */
function getSubjectFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('subject');
}

/**
 * Filter items by subject
 * @param {Array} items - Array of items (videos/quizzes/files)
 * @param {string} subjectId - Subject ID to filter by (null for all)
 * @returns {Array} Filtered items
 */
function filterBySubject(items, subjectId) {
    if (!subjectId || subjectId === 'all') {
        return items;
    }
    return items.filter(item => item.subject_id === subjectId);
}

/**
 * Create a new subject
 * @param {Object} subjectData - Subject data object
 * @returns {Promise<Object>} Created subject
 */
async function createSubject(subjectData) {
    try {
        const { data, error } = await supabaseClient
            .from('subjects')
            .insert(subjectData)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creating subject:', error);
        throw error;
    }
}

/**
 * Update a subject
 * @param {string} id - Subject UUID
 * @param {Object} updates - Object with fields to update
 * @returns {Promise<Object>} Updated subject
 */
async function updateSubject(id, updates) {
    try {
        const { data, error } = await supabaseClient
            .from('subjects')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error updating subject:', error);
        throw error;
    }
}

/**
 * Delete a subject
 * @param {string} id - Subject UUID
 * @returns {Promise<void>}
 */
async function deleteSubject(id) {
    try {
        const { error } = await supabaseClient
            .from('subjects')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    } catch (error) {
        console.error('Error deleting subject:', error);
        throw error;
    }
}
