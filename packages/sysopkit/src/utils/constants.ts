/**
 * @module constants
 *
 * Constants used throughout the framework.
 */

/** Event listener options for single-fire events. */
export const ONCE = { once: true };

/** Options to indicate streaming mode should be enabled. */
export const STREAM_TRUE = { stream: true };

/** Reusable TextEncoder instance for string-to-bytes conversion. */
export const TEXT_ENCODER: TextEncoder = new TextEncoder();

/** Reusable TextDecoder instance for bytes-to-string conversion. */
export const TEXT_DECODER: TextDecoder = new TextDecoder();
