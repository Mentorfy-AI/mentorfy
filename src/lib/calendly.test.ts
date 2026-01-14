import { describe, expect, test } from 'bun:test'
import { getCalendlyUrlWithSession } from './calendly'

describe('getCalendlyUrlWithSession', () => {
  const baseUrl = 'https://calendly.com/brady-mentorfy/30min'

  test('appends session_id to URL without existing params', () => {
    const result = getCalendlyUrlWithSession(baseUrl, 'abc123')
    expect(result).toBe('https://calendly.com/brady-mentorfy/30min?session_id=abc123')
  })

  test('appends session_id to URL with existing params', () => {
    const urlWithParams = 'https://calendly.com/brady-mentorfy/30min?utm_source=test'
    const result = getCalendlyUrlWithSession(urlWithParams, 'abc123')
    expect(result).toBe('https://calendly.com/brady-mentorfy/30min?utm_source=test&session_id=abc123')
  })

  test('returns original URL when sessionId is undefined', () => {
    const result = getCalendlyUrlWithSession(baseUrl, undefined)
    expect(result).toBe(baseUrl)
  })

  test('returns original URL when sessionId is empty string', () => {
    const result = getCalendlyUrlWithSession(baseUrl, '')
    expect(result).toBe(baseUrl)
  })

  test('handles special characters in sessionId', () => {
    const result = getCalendlyUrlWithSession(baseUrl, 'session-with-dashes_and_underscores')
    expect(result).toBe('https://calendly.com/brady-mentorfy/30min?session_id=session-with-dashes_and_underscores')
  })

  test('overwrites existing session_id if present', () => {
    const urlWithSession = 'https://calendly.com/brady-mentorfy/30min?session_id=old'
    const result = getCalendlyUrlWithSession(urlWithSession, 'new')
    expect(result).toBe('https://calendly.com/brady-mentorfy/30min?session_id=new')
  })
})
