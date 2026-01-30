/**
 * Announcements Module
 * Handles displaying and managing announcements banner
 */

/**
 * Get all active announcements
 * @returns {Promise<Array>} Array of active announcement objects
 */
async function getAllActiveAnnouncements() {
    try {
        const { data, error } = await supabaseClient
            .from('announcements')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching announcements:', error);
        return [];
    }
}

/**
 * Create announcement HTML element
 * @param {Object} announcement - Announcement object
 * @returns {string} HTML string
 */
function createAnnouncementElement(announcement) {
    const typeIcons = {
        'info': 'ℹ️',
        'warning': '⚠️',
        'success': '✅',
        'error': '❌'
    };

    const icon = typeIcons[announcement.type] || typeIcons.info;
    
    return `
        <div class="announcement-item announcement-${announcement.type}" data-id="${announcement.id}">
            <div class="announcement-content">
                <span class="announcement-icon">${icon}</span>
                <div class="announcement-text">
                    <strong class="announcement-title">${announcement.title_ar}</strong>
                    <p class="announcement-message">${announcement.content_ar}</p>
                </div>
            </div>
            <button class="announcement-close" onclick="closeAnnouncement('${announcement.id}')" aria-label="إغلاق">
                ×
            </button>
        </div>
    `;
}

/**
 * Render announcement banner on page
 * @param {string} containerId - ID of container element (default: 'announcementBanner')
 */
async function renderAnnouncementBanner(containerId = 'announcementBanner') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Container element with ID '${containerId}' not found`);
        return;
    }

    try {
        const announcements = await getAllActiveAnnouncements();
        
        if (announcements.length === 0) {
            container.style.display = 'none';
            return;
        }

        // Get closed announcements from localStorage
        const closedAnnouncements = JSON.parse(localStorage.getItem('closedAnnouncements') || '[]');
        
        // Filter out closed announcements
        const visibleAnnouncements = announcements.filter(
            ann => !closedAnnouncements.includes(ann.id)
        );

        if (visibleAnnouncements.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.innerHTML = visibleAnnouncements
            .map(announcement => createAnnouncementElement(announcement))
            .join('');
        
        container.style.display = 'block';
    } catch (error) {
        console.error('Error rendering announcement banner:', error);
    }
}

/**
 * Close (hide) an announcement
 * @param {string} announcementId - UUID of announcement to close
 */
function closeAnnouncement(announcementId) {
    // Add to closed announcements in localStorage
    const closedAnnouncements = JSON.parse(localStorage.getItem('closedAnnouncements') || '[]');
    if (!closedAnnouncements.includes(announcementId)) {
        closedAnnouncements.push(announcementId);
        localStorage.setItem('closedAnnouncements', JSON.stringify(closedAnnouncements));
    }

    // Remove the announcement element from DOM
    const announcementElement = document.querySelector(`[data-id="${announcementId}"]`);
    if (announcementElement) {
        announcementElement.style.opacity = '0';
        setTimeout(() => {
            announcementElement.remove();
            
            // Hide container if no announcements left
            const container = document.getElementById('announcementBanner');
            if (container && container.children.length === 0) {
                container.style.display = 'none';
            }
        }, 300);
    }
}

// Auto-render announcements when DOM is ready (if announcementBanner div exists)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('announcementBanner')) {
            renderAnnouncementBanner();
        }
    });
} else {
    if (document.getElementById('announcementBanner')) {
        renderAnnouncementBanner();
    }
}
