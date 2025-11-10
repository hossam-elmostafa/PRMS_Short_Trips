const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class ImageService {
    constructor() {
        // Get base path from environment variable, config file, or use current directory as default
        // Priority: 1. Environment variable 2. Config file 3. process.cwd()
        let basePath = process.env.IMAGES_BASE_PATH;
        
        // If not in environment, try to load from config.json
        if (!basePath) {
            try {
                // First try runtime config path (external config file)
                const configPath = process.env.RUNTIME_CONFIG_PATH || process.env.RUNTIME_CONFIG_FILE || process.env.BASE_API_CONFIG_PATH;
                if (configPath && fsSync.existsSync(configPath)) {
                    const config = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
                    basePath = config.IMAGES_BASE_PATH;
                }
                
                // If still not found, try embedded config.json in build folder
                if (!basePath) {
                    const embeddedConfigPath = path.join(__dirname, '..', 'Client', 'build', 'config.json');
                    if (fsSync.existsSync(embeddedConfigPath)) {
                        const config = JSON.parse(fsSync.readFileSync(embeddedConfigPath, 'utf8'));
                        basePath = config.IMAGES_BASE_PATH;
                        console.log('[ImageService] Loaded IMAGES_BASE_PATH from embedded config:', basePath);
                    }
                }
                
                // Also try the source config.json in public folder (for development)
                if (!basePath) {
                    const publicConfigPath = path.join(__dirname, '..', '..', 'Frontend', 'public', 'config.json');
                    if (fsSync.existsSync(publicConfigPath)) {
                        const config = JSON.parse(fsSync.readFileSync(publicConfigPath, 'utf8'));
                        basePath = config.IMAGES_BASE_PATH;
                        console.log('[ImageService] Loaded IMAGES_BASE_PATH from public config:', basePath);
                    }
                }
            } catch (e) {
                // Ignore config file errors - will default to process.cwd()
                console.log('Could not load IMAGES_BASE_PATH from config, using default:', e.message);
            }
        }
        
        // Default to current working directory if not configured or if empty string
        // Resolve to absolute path and normalize
        if (basePath && basePath.trim()) {
            this.basePath = path.resolve(basePath.trim());
            console.log('[ImageService] Using configured base path:', this.basePath);
        } else {
            this.basePath = process.cwd();
            console.log('[ImageService] No IMAGES_BASE_PATH configured, using process.cwd():', this.basePath);
            console.log('[ImageService] To configure, set IMAGES_BASE_PATH in config.json or environment variable');
        }
        
        // Verify the base path exists
        try {
            if (fsSync.existsSync(this.basePath)) {
                const stats = fsSync.statSync(this.basePath);
                if (stats.isDirectory()) {
                    console.log('[ImageService] Base path verified and is a directory');
                } else {
                    console.warn('[ImageService] WARNING: Base path exists but is not a directory!');
                }
            } else {
                console.warn('[ImageService] WARNING: Base path does not exist:', this.basePath);
            }
        } catch (err) {
            console.warn('[ImageService] WARNING: Could not verify base path:', err.message);
        }
    }

    /**
     * Normalize a path from database to a relative path
     * The database should store relative paths (e.g., "143184823.jpg" or "Prms\Shorttrips\pic1.jpg")
     * If an absolute path is found (for backward compatibility), extract just the filename
     * @param {string} dbPath - Path from database (should be relative, but may be absolute for backward compatibility)
     * @returns {string} - Normalized relative path
     */
    normalizePath(dbPath) {
        if (!dbPath) {
            return '';
        }
        
        const trimmed = String(dbPath).trim();
        if (!trimmed) {
            return '';
        }
        
        // Check if it's an absolute path (Windows: C:\, D:\, etc. or Unix: /)
        const isAbsolute = path.isAbsolute(trimmed) || /^[A-Za-z]:[\\\/]/.test(trimmed);
        
        if (isAbsolute) {
            // For backward compatibility: if DB still has absolute paths, extract filename
            // This allows migration period where some records have absolute paths
            const filename = path.basename(trimmed);
            console.log(`Warning: Database contains absolute path "${trimmed}". Extracted filename "${filename}". Please update DB to store relative paths only.`);
            return filename;
        }
        
        // It's a relative path from database - use it as-is
        // Normalize path separators to use OS-appropriate separators
        // But preserve the relative path structure (e.g., "Prms/Shorttrips/pic1.jpg")
        return trimmed.replace(/\\/g, path.sep);
    }

    getFullPath(relativePath) {
        if (!relativePath) {
            throw new Error('Relative path is required');
        }
        
        // Normalize the path first (handle absolute paths from DB)
        const normalized = this.normalizePath(relativePath);
        
        if (!normalized) {
            throw new Error('Normalized path is empty');
        }
        
        // Combine base path with normalized relative path
        const fullPath = path.join(this.basePath, normalized);
        
        // Resolve to absolute path
        const resolvedPath = path.resolve(fullPath);
        
        return resolvedPath;
    }

    async imageExists(relativePath) {
        try {
            const fullPath = this.getFullPath(relativePath);
            await fs.access(fullPath);
            return true;
        } catch (error) {
            const fullPath = this.getFullPath(relativePath);
            console.log(`[ImageService] Image not found at: ${fullPath}`);
            return false;
        }
    }

    async loadImage(relativePath) {
        try {
            const fullPath = this.getFullPath(relativePath);
            
            // Security check: ensure the resolved path is within the base directory
            const resolvedPath = path.resolve(fullPath);
            const resolvedBase = path.resolve(this.basePath);
            
            // On Windows, normalize paths for comparison (case-insensitive)
            const normalizedResolved = process.platform === 'win32' 
                ? resolvedPath.toLowerCase() 
                : resolvedPath;
            const normalizedBase = process.platform === 'win32'
                ? resolvedBase.toLowerCase()
                : resolvedBase;
            
            if (!normalizedResolved.startsWith(normalizedBase)) {
                throw new Error('Access denied: Path traversal attempt detected');
            }

            const imageBuffer = await fs.readFile(fullPath);
            return imageBuffer;
        } catch (error) {
            console.error(`Error loading image from ${relativePath}:`, error);
            throw new Error(`Failed to load image: ${error.message}`);
        }
    }

    getMimeType(relativePath) {
        const ext = path.extname(relativePath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}

module.exports = new ImageService();