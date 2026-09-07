/**
 * Normalize a directory path used by the public browser.
 * Returns null for traversal segments instead of silently rewriting the path.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizePublicDirectory(value) {
    const normalized = String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/\/{2,}/g, '/')
        .replace(/^\/+|\/+$/g, '');

    if (normalized.split('/').some(segment => segment === '.' || segment === '..')) {
        return null;
    }

    return normalized;
}

/**
 * Normalize and de-duplicate configured public roots.
 * A wildcard keeps the existing "allow all" behavior.
 *
 * @param {string[]} allowedDirs
 * @returns {string[]|null} null means the configuration contained only invalid paths
 */
export function normalizeAllowedDirectories(allowedDirs) {
    const normalized = [];
    let hadConfiguredDirectory = false;

    for (const value of allowedDirs || []) {
        const configured = String(value).trim();
        if (!configured) continue;
        hadConfiguredDirectory = true;
        const directory = normalizePublicDirectory(configured);
        if (directory === null) continue;
        if (directory === '*') return ['*'];
        if (!normalized.includes(directory)) normalized.push(directory);
    }

    return hadConfiguredDirectory && normalized.length === 0 ? null : normalized;
}

/**
 * Classify requested directory access.
 * "navigation" means the directory is only an ancestor of an allowed root;
 * callers may show the permitted path towards that root but must not read it.
 *
 * @param {string} dir
 * @param {string[]} allowedDirs
 * @returns {'content'|'navigation'|'denied'}
 */
export function getPublicDirectoryAccess(dir, allowedDirs) {
    const normalizedDir = normalizePublicDirectory(dir);
    if (normalizedDir === null || allowedDirs === null) return 'denied';
    if (!allowedDirs || allowedDirs.length === 0 || allowedDirs.includes('*')) return 'content';

    for (const allowed of allowedDirs) {
        if (normalizedDir === allowed || normalizedDir.startsWith(`${allowed}/`)) {
            return 'content';
        }
        if (normalizedDir === '' || allowed.startsWith(`${normalizedDir}/`)) {
            return 'navigation';
        }
    }

    return 'denied';
}

/**
 * Build the next virtual directory entries on a path towards allowed roots.
 * This avoids reading or revealing sibling directories outside the allow-list.
 *
 * @param {string} dir
 * @param {string[]} allowedDirs
 * @returns {string[]}
 */
export function getAllowedChildDirectories(dir, allowedDirs) {
    const normalizedDir = normalizePublicDirectory(dir);
    if (normalizedDir === null || allowedDirs === null) return [];

    const prefix = normalizedDir ? `${normalizedDir}/` : '';
    const children = new Set();
    for (const allowed of allowedDirs || []) {
        if (allowed === '*' || !allowed.startsWith(prefix) || allowed === normalizedDir) continue;
        const nextSegment = allowed.slice(prefix.length).split('/')[0];
        if (nextSegment) children.add(`${prefix}${nextSegment}`);
    }

    return Array.from(children);
}
