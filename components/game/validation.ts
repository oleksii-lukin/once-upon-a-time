/**
 * Shared validation utilities for XState game machine actors
 *
 * This file contains common validation functions used across multiple actors
 * to avoid code duplication and ensure consistent validation logic.
 */

/**
 * Validates if a string is a non-empty UUID-like string
 * @param value - The value to validate
 * @param fieldName - The name of the field for error messages
 * @throws Error if the value is invalid
 */
export function validateUUID(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string, received ${typeof value}`)
  }
  if (value.trim() === '') {
    throw new Error(`${fieldName} cannot be empty`)
  }
  // Basic UUID format check (8-4-4-4-12 characters)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(value)) {
    throw new Error(`${fieldName} must be a valid UUID format, received: ${value}`)
  }
}

/**
 * Validates if a value is a positive number
 * @param value - The value to validate
 * @param fieldName - The name of the field for error messages
 * @throws Error if the value is invalid
 */
export function validatePositiveNumber(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== 'number') {
    throw new Error(`${fieldName} must be a number, received ${typeof value}`)
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer, received: ${value}`)
  }
  if (value <= 0) {
    throw new Error(`${fieldName} must be greater than 0, received: ${value}`)
  }
}

/**
 * Validates if a value is a non-negative number
 * @param value - The value to validate
 * @param fieldName - The name of the field for error messages
 * @throws Error if the value is invalid
 */
export function validateNonNegativeNumber(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== 'number') {
    throw new Error(`${fieldName} must be a number, received ${typeof value}`)
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer, received: ${value}`)
  }
  if (value < 0) {
    throw new Error(`${fieldName} must be greater than or equal to 0, received: ${value}`)
  }
}
