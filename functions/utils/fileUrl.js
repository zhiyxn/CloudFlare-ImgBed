// Encode individual segments so nested directories remain separate URL segments.
export function fileUrl(origin, fileId) {
    return `${origin}/file/${fileId.split('/').map(encodeURIComponent).join('/')}`;
}
