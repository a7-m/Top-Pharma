// Content Protection Helpers

function enableContentProtection(options = {}) {
    const {
        watermarkText = '',
        targetId = null,
        blockContextMenu = true,
        blockKeys = true,
        blockSelection = true
    } = options;

    if (blockSelection) {
        document.body.classList.add('content-protected');
    }

    if (blockContextMenu) {
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }

    if (blockKeys) {
        document.addEventListener('keydown', (event) => {
            const key = event.key?.toLowerCase();
            const ctrl = event.ctrlKey || event.metaKey;

            const blockedCombos = ctrl && (
                key === 's' ||
                key === 'p' ||
                key === 'u' ||
                key === 'c' ||
                key === 'x' ||
                key === 'i' ||
                key === 'j'
            );

            if (blockedCombos || key === 'printscreen') {
                event.preventDefault();
                if (typeof showToast === 'function') {
                    showToast('التنزيل أو النسخ غير مسموح لهذا المحتوى', 'error');
                }
            }
        });
    }

    if (targetId && watermarkText) {
        const target = document.getElementById(targetId);
        if (!target) return;

        if (!target.classList.contains('content-protected-container')) {
            target.classList.add('content-protected-container');
        }

        if (target.querySelector('.content-protection-layer')) return;

        const layer = document.createElement('div');
        layer.className = 'content-protection-layer';

        const watermark = document.createElement('div');
        watermark.className = 'content-watermark';

        const repeatCount = 12;
        for (let i = 0; i < repeatCount; i += 1) {
            const span = document.createElement('span');
            span.textContent = watermarkText;
            watermark.appendChild(span);
        }

        layer.appendChild(watermark);
        target.appendChild(layer);
    }
}

function applyVideoElementProtection(videoElement) {
    if (!videoElement) return;
    videoElement.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
    videoElement.setAttribute('disablePictureInPicture', '');
    videoElement.setAttribute('oncontextmenu', 'return false');
}
