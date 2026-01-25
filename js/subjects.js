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
 * Render subject cards for dashboard
 * @param {string} containerId - Container element ID
 * @param {string} linkTemplate - Link template (use {id} placeholder)
 */
async function renderSubjectCards(containerId, linkTemplate = 'videos.html?subject={id}') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID '${containerId}' not found`);
        return;
    }

    try {
        const subjects = await getAllSubjects();

        // Define colors for each subject
        const colors = ['#2ecc71', '#3498db', '#9b59b6', '#e74c3c'];

        container.innerHTML = subjects.map((subject, index) => {
            const priceLabel = subject.price_egp === 0 ? 'مجاني' : `${subject.price_egp || 0} جنيه`;
            return `
                <div class="subject-card" 
                     data-subject-id="${subject.id}"
                     data-subject-link="${linkTemplate.replace('{id}', subject.id)}"
                     style="--subject-color: ${colors[index % colors.length]}">
                    <div class="subject-icon">${subject.icon}</div>
                    <h3>${subject.name_ar}</h3>
                    <p class="subject-name-en">${subject.name_en}</p>
                    <p class="subject-description">${subject.description || ''}</p>
                    <div class="subject-price">${priceLabel}</div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.subject-card').forEach(card => {
            card.addEventListener('click', async () => {
                const subjectId = card.dataset.subjectId;
                const targetLink = card.dataset.subjectLink;
                const status = await getSubjectAccessStatus(subjectId);
                if (!status.hasAccess) {
                    window.location.href = buildSubjectPaymentUrl(subjectId, targetLink);
                    return;
                }
                window.location.href = targetLink;
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
