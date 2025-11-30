/**
 * URL Normalizer Module
 * Implements URL parsing, validation, normalization, and domain extraction
 * Requirements: 2.6
 */

// List of tracking parameters to remove during normalization
const TRACKING_PARAMS = [
  // UTM parameters
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_source_platform',
  'utm_creative_format',
  'utm_marketing_tactic',
  // Facebook
  'fbclid',
  'fb_action_ids',
  'fb_action_types',
  'fb_source',
  'fb_ref',
  // Google
  'gclid',
  'gclsrc',
  'dclid',
  // Microsoft/Bing
  'msclkid',
  // Twitter
  'twclid',
  // Mailchimp
  'mc_cid',
  'mc_eid',
  // HubSpot
  'hsa_acc',
  'hsa_cam',
  'hsa_grp',
  'hsa_ad',
  'hsa_src',
  'hsa_tgt',
  'hsa_kw',
  'hsa_mt',
  'hsa_net',
  'hsa_ver',
  // Other common tracking params
  'ref',
  'ref_src',
  'ref_url',
  '_ga',
  '_gl',
  'yclid',
  'wickedid',
  'igshid',
  's_kwcid',
  'si',
  'spm',
  'pvid',
  'scm',
  'algo_pvid',
  'algo_expid',
  '_hsenc',
  '_hsmi',
  'mkt_tok',
];

/**
 * Result of URL validation
 */
export interface URLValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates if a string is a valid URL
 */
export function validateURL(url: string): URLValidationResult {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL must be a non-empty string' };
  }

  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { isValid: false, error: 'URL must use http or https protocol' };
    }
    
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Removes tracking parameters from a URL
 * Preserves all other query parameters
 */
export function removeTrackingParams(url: string): string {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  
  // Remove tracking parameters (case-insensitive check)
  const keysToRemove: string[] = [];
  params.forEach((_, key) => {
    const lowerKey = key.toLowerCase();
    if (
      TRACKING_PARAMS.includes(lowerKey) ||
      lowerKey.startsWith('utm_') ||
      lowerKey.startsWith('fb_') ||
      lowerKey.startsWith('hsa_')
    ) {
      keysToRemove.push(key);
    }
  });
  
  keysToRemove.forEach(key => params.delete(key));
  
  parsed.search = params.toString();
  return parsed.toString();
}

/**
 * Normalizes a URL for consistent storage and duplicate detection
 * 
 * Normalization steps:
 * 1. Parse URL and validate
 * 2. Lowercase scheme and host
 * 3. Remove default ports (80 for http, 443 for https)
 * 4. Sort query parameters alphabetically
 * 5. Remove tracking parameters
 * 6. Remove trailing slashes from path (except root)
 * 7. Decode unnecessary percent-encoding
 * 8. Remove fragment (hash)
 */
export function normalizeURL(url: string): string {
  const validation = validateURL(url);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const parsed = new URL(url);
  
  // 1. Lowercase scheme (already done by URL constructor)
  // 2. Lowercase host
  parsed.hostname = parsed.hostname.toLowerCase();
  
  // 3. Remove default ports
  if (
    (parsed.protocol === 'http:' && parsed.port === '80') ||
    (parsed.protocol === 'https:' && parsed.port === '443')
  ) {
    parsed.port = '';
  }
  
  // 4. Remove tracking parameters first
  const params = new URLSearchParams(parsed.search);
  const keysToRemove: string[] = [];
  params.forEach((_, key) => {
    const lowerKey = key.toLowerCase();
    if (
      TRACKING_PARAMS.includes(lowerKey) ||
      lowerKey.startsWith('utm_') ||
      lowerKey.startsWith('fb_') ||
      lowerKey.startsWith('hsa_')
    ) {
      keysToRemove.push(key);
    }
  });
  keysToRemove.forEach(key => params.delete(key));
  
  // 5. Sort remaining query parameters alphabetically
  const sortedParams = new URLSearchParams();
  const sortedKeys = Array.from(params.keys()).sort();
  for (const key of sortedKeys) {
    const values = params.getAll(key);
    for (const value of values) {
      sortedParams.append(key, value);
    }
  }
  parsed.search = sortedParams.toString();
  
  // 6. Remove trailing slashes from path (except for root path)
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }
  
  // 7. Decode unnecessary percent-encoding in path
  // The URL constructor handles most of this, but we normalize common cases
  try {
    parsed.pathname = decodeURIComponent(parsed.pathname)
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
  } catch {
    // If decoding fails, keep the original path
  }
  
  // 8. Remove fragment (hash)
  parsed.hash = '';
  
  return parsed.toString();
}

/**
 * Extracts the domain from a URL
 * Returns the hostname without 'www.' prefix
 */
export function extractDomain(url: string): string {
  const validation = validateURL(url);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const parsed = new URL(url);
  let domain = parsed.hostname.toLowerCase();
  
  // Remove www. prefix if present
  if (domain.startsWith('www.')) {
    domain = domain.substring(4);
  }
  
  return domain;
}

/**
 * Checks if a URL contains any tracking parameters
 */
export function hasTrackingParams(url: string): boolean {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  
  for (const key of params.keys()) {
    const lowerKey = key.toLowerCase();
    if (
      TRACKING_PARAMS.includes(lowerKey) ||
      lowerKey.startsWith('utm_') ||
      lowerKey.startsWith('fb_') ||
      lowerKey.startsWith('hsa_')
    ) {
      return true;
    }
  }
  
  return false;
}

/**
 * Gets the list of tracking parameters that would be removed
 */
export function getTrackingParamsFromURL(url: string): string[] {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const trackingFound: string[] = [];
  
  for (const key of params.keys()) {
    const lowerKey = key.toLowerCase();
    if (
      TRACKING_PARAMS.includes(lowerKey) ||
      lowerKey.startsWith('utm_') ||
      lowerKey.startsWith('fb_') ||
      lowerKey.startsWith('hsa_')
    ) {
      trackingFound.push(key);
    }
  }
  
  return trackingFound;
}

// Export the list of tracking params for testing
export { TRACKING_PARAMS };
