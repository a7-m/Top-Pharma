/**
 * Mobile Navigation Controller
 * Handles hamburger menu functionality for mobile devices
 */

(function() {
    'use strict';

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileNav);
    } else {
        initMobileNav();
    }

    function initMobileNav() {
        // Create hamburger menu button if it doesn't exist
        createHamburgerMenu();
        
        // Create mobile menu overlay and container
        createMobileMenu();
        
        // Attach event listeners
        attachEventListeners();
    }

    function createHamburgerMenu() {
        const navbar = document.querySelector('.navbar-container');
        if (!navbar) return;

        // Check if hamburger already exists
        if (document.querySelector('.hamburger-menu')) return;

        const hamburger = document.createElement('button');
        hamburger.className = 'hamburger-menu hide-desktop';
        hamburger.setAttribute('aria-label', 'Toggle menu');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;

        navbar.appendChild(hamburger);
    }

    function createMobileMenu() {
        // Check if mobile menu already exists
        if (document.querySelector('.mobile-menu')) return;

        const navbarMenu = document.querySelector('.navbar-menu');
        if (!navbarMenu) return;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'mobile-menu-overlay';
        
        // Create mobile menu container
        const mobileMenu = document.createElement('div');
        mobileMenu.className = 'mobile-menu';
        
        // Clone menu items
        const menuClone = navbarMenu.cloneNode(true);
        menuClone.className = 'mobile-menu-list';
        mobileMenu.appendChild(menuClone);

        // Add to body
        document.body.appendChild(overlay);
        document.body.appendChild(mobileMenu);
    }

    function attachEventListeners() {
        const hamburger = document.querySelector('.hamburger-menu');
        const overlay = document.querySelector('.mobile-menu-overlay');
        const mobileMenu = document.querySelector('.mobile-menu');
        const menuLinks = document.querySelectorAll('.mobile-menu a');

        if (!hamburger || !overlay || !mobileMenu) return;

        // Toggle menu on hamburger click
        hamburger.addEventListener('click', toggleMenu);

        // Close menu on overlay click
        overlay.addEventListener('click', closeMenu);

        // Close menu on link click
        menuLinks.forEach(link => {
            link.addEventListener('click', closeMenu);
        });

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMenu();
            }
        });
    }

    function toggleMenu() {
        const hamburger = document.querySelector('.hamburger-menu');
        const overlay = document.querySelector('.mobile-menu-overlay');
        const mobileMenu = document.querySelector('.mobile-menu');
        const body = document.body;

        if (!hamburger || !overlay || !mobileMenu) return;

        const isOpen = hamburger.classList.contains('active');

        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    function openMenu() {
        const hamburger = document.querySelector('.hamburger-menu');
        const overlay = document.querySelector('.mobile-menu-overlay');
        const mobileMenu = document.querySelector('.mobile-menu');
        const body = document.body;

        hamburger.classList.add('active');
        overlay.classList.add('active');
        mobileMenu.classList.add('active');
        body.classList.add('menu-open');
        
        hamburger.setAttribute('aria-expanded', 'true');
        
        // Trap focus in menu
        trapFocus(mobileMenu);
    }

    function closeMenu() {
        const hamburger = document.querySelector('.hamburger-menu');
        const overlay = document.querySelector('.mobile-menu-overlay');
        const mobileMenu = document.querySelector('.mobile-menu');
        const body = document.body;

        if (!hamburger) return;

        hamburger.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        if (mobileMenu) mobileMenu.classList.remove('active');
        body.classList.remove('menu-open');
        
        hamburger.setAttribute('aria-expanded', 'false');
    }

    function trapFocus(element) {
        const focusableElements = element.querySelectorAll(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])'
        );
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        element.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });

        // Focus first element
        firstElement.focus();
    }

    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Close mobile menu if window is resized to desktop size
            if (window.innerWidth > 768) {
                closeMenu();
            }
        }, 250);
    });

})();
