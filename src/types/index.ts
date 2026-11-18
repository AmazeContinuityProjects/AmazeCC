/**
 * Central Export Barrel for AmazeCC Types.
 *
 * Provides a single, clean import point for all application domains:
 * courses, faculty, local storage schemas, domain models, and unified aggregates.
 */

// Core Academic Models
export * from "./course";
export * from "./faculty";

// Unified Domain Models
export * from "./auth";
export * from "./academics";
export * from "./marks";
export * from "./ffcs";
export * from "./campus";
export * from "./events";
export * from "./social";
export * from "./appSettings";

// LocalStorage Schema & Key Types
export * from "./storage";

// Domain Specific Models
export * from "./payments";
export * from "./transport";
export * from "./tasks";
export * from "./qbank.types";
