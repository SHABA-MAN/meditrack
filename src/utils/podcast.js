/**
 * Podcast Metadata Utility
 * 
 * Extracts metadata from podcast URLs (Spotify, Apple Podcasts).
 * Uses public oEmbed / embed APIs — no API keys required.
 */

/**
 * Detect podcast platform from URL
 */
export const detectPodcastPlatform = (url) => {
    if (!url) return null;
    if (url.includes('open.spotify.com')) return 'spotify';
    if (url.includes('podcasts.apple.com')) return 'apple';
    if (url.includes('soundcloud.com')) return 'soundcloud';
    return null;
};

/**
 * Extract Spotify episode/show ID from URL
 * Supports: 
 *   https://open.spotify.com/episode/XXXXX
 *   https://open.spotify.com/show/XXXXX
 */
export const getSpotifyId = (url) => {
    const match = url.match(/open\.spotify\.com\/(episode|show)\/([a-zA-Z0-9]+)/);
    return match ? { type: match[1], id: match[2] } : null;
};

/**
 * Get Spotify embed URL for inline playback
 */
export const getSpotifyEmbedUrl = (url) => {
    const info = getSpotifyId(url);
    if (!info) return null;
    return `https://open.spotify.com/embed/${info.type}/${info.id}?utm_source=generator&theme=0`;
};

/**
 * Fetch Spotify metadata using oEmbed API (no auth needed)
 */
export const fetchSpotifyMetadata = async (url) => {
    try {
        const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('Failed to fetch Spotify metadata');
        const data = await response.json();
        return {
            title: data.title,
            provider: 'Spotify',
            thumbnail: data.thumbnail_url,
            embedHtml: data.html,
            embedUrl: getSpotifyEmbedUrl(url),
            type: data.type, // "rich"
        };
    } catch (error) {
        console.warn('Spotify metadata fetch failed:', error);
        return null;
    }
};

/**
 * Extract Apple Podcasts episode/show ID
 * Supports:
 *   https://podcasts.apple.com/us/podcast/show-name/id123456?i=789
 */
export const getApplePodcastId = (url) => {
    const idMatch = url.match(/\/id(\d+)/);
    const episodeMatch = url.match(/[?&]i=(\d+)/);
    return {
        showId: idMatch ? idMatch[1] : null,
        episodeId: episodeMatch ? episodeMatch[1] : null
    };
};

/**
 * Get Apple Podcasts embed URL 
 */
export const getApplePodcastEmbedUrl = (url) => {
    const { showId, episodeId } = getApplePodcastId(url);
    if (!showId) return null;
    let embedUrl = `https://embed.podcasts.apple.com/us/podcast/id${showId}`;
    if (episodeId) embedUrl += `?i=${episodeId}`;
    embedUrl += `${episodeId ? '&' : '?'}theme=dark`;
    return embedUrl;
};

/**
 * Fetch podcast metadata (auto-detects platform)
 */
export const fetchPodcastMetadata = async (url) => {
    const platform = detectPodcastPlatform(url);

    switch (platform) {
        case 'spotify':
            return await fetchSpotifyMetadata(url);
        case 'apple': {
            // Apple doesn't have a public oEmbed, but we can construct embed data
            const embedUrl = getApplePodcastEmbedUrl(url);
            return embedUrl ? {
                title: 'Apple Podcast Episode',
                provider: 'Apple Podcasts',
                thumbnail: null,
                embedUrl,
                type: 'podcast'
            } : null;
        }
        default:
            return null;
    }
};

/**
 * Check if a URL is a podcast link
 */
export const isPodcastUrl = (url) => detectPodcastPlatform(url) !== null;
