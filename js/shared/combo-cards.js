/**
 * Shared combo card renderer for multi-image display
 * Used by: reality_prompt_generator.js, batch_image_generator.js
 */

/**
 * Render combo cards HTML for multi-image mode
 * @param {Array} inputsWithImages - Array of {label, images/urls} objects
 * @param {Object} options - { getImageUrl: function to extract URL from item }
 * @returns {string} HTML string for combo cards
 */
export function renderComboCards(inputsWithImages, options = {}) {
    const getItems = (input) => input.images || input.urls || [];
    const maxLen = Math.max(...inputsWithImages.map(i => getItems(i).length));

    let html = '';
    for (let idx = 0; idx < maxLen; idx++) {
        const slots = inputsWithImages.map(input => {
            const items = getItems(input);
            const item = items[idx];
            const url = options.getImageUrl ? options.getImageUrl(item) : (item?.url || item);

            if (url) {
                return `
                    <div class="instaraw-combo-slot">
                        <div class="instaraw-combo-slot-image">
                            <img src="${url}" alt="${input.label}" style="background: rgba(0,0,0,0.3);" onerror="this.style.opacity='0.3'; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%239ca3af%22 d=%22M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z%22/%3E%3C/svg%3E';" />
                        </div>
                        <span class="instaraw-combo-slot-label">${input.label}</span>
                    </div>
                `;
            } else {
                return `
                    <div class="instaraw-combo-slot">
                        <div class="instaraw-combo-slot-image empty"></div>
                        <span class="instaraw-combo-slot-label">${input.label}</span>
                    </div>
                `;
            }
        }).join('');

        html += `
            <div class="instaraw-combo-card">
                <div class="instaraw-combo-header">
                    <span class="instaraw-combo-number">#${idx + 1}</span>
                </div>
                <div class="instaraw-combo-slots">
                    ${slots}
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Get the maximum length across all inputs
 * @param {Array} inputsWithImages - Array of {label, images/urls} objects
 * @returns {number} Maximum number of items
 */
export function getComboMaxLength(inputsWithImages) {
    const getItems = (input) => input.images || input.urls || [];
    return Math.max(...inputsWithImages.map(i => getItems(i).length));
}
