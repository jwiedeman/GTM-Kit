/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { GtmScripts } from '../scripts';

// Mock the core package
jest.mock('@jwiedeman/gtm-kit', () => ({
  createNoscriptMarkup: jest.fn(() => '<noscript><iframe src="test"></iframe></noscript>')
}));

describe('GtmScripts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders script tags for a single container', () => {
    const { container } = render(<GtmScripts containers="GTM-ABC123" />);

    const script = container.querySelector('script');
    expect(script).toBeTruthy();
    expect(script?.innerHTML).toContain('GTM-ABC123');
    expect(script?.innerHTML).toContain('dataLayer');
  });

  it('renders script tags for multiple containers', () => {
    const { container } = render(<GtmScripts containers={['GTM-ABC123', 'GTM-DEF456']} />);

    const script = container.querySelector('script');
    expect(script).toBeTruthy();
    expect(script?.innerHTML).toContain('GTM-ABC123');
    expect(script?.innerHTML).toContain('GTM-DEF456');
  });

  it('uses custom dataLayer name', () => {
    const { container } = render(<GtmScripts containers="GTM-ABC123" dataLayerName="customLayer" />);

    const script = container.querySelector('script');
    expect(script?.innerHTML).toContain('customLayer');
  });

  it('includes nonce in script when provided', () => {
    const { container } = render(<GtmScripts containers="GTM-ABC123" scriptAttributes={{ nonce: 'test-nonce-123' }} />);

    const script = container.querySelector('script');
    expect(script?.getAttribute('nonce')).toBe('test-nonce-123');
    expect(script?.innerHTML).toContain("j.nonce='test-nonce-123'");
  });

  it('renders noscript fallback', () => {
    const { container } = render(<GtmScripts containers="GTM-ABC123" />);

    const noscript = container.querySelector('noscript');
    expect(noscript).toBeTruthy();
  });

  describe('XSS prevention', () => {
    it('escapes single quotes in container ID', () => {
      const { container } = render(<GtmScripts containers="GTM-ABC'123" />);

      const script = container.querySelector('script');
      // Should escape the quote to prevent XSS
      expect(script?.innerHTML).not.toContain("GTM-ABC'123");
      expect(script?.innerHTML).toContain("GTM-ABC\\'123");
    });

    it('escapes double quotes in container ID', () => {
      const { container } = render(<GtmScripts containers={'GTM-ABC"123'} />);

      const script = container.querySelector('script');
      expect(script?.innerHTML).toContain('GTM-ABC\\"123');
    });

    it('escapes script tags in container ID', () => {
      const { container } = render(<GtmScripts containers="GTM-<script>" />);

      const script = container.querySelector('script');
      // < and > should be escaped to prevent script injection
      expect(script?.innerHTML).not.toContain('<script>');
      expect(script?.innerHTML).toContain('\\x3cscript\\x3e');
    });

    it('rejects invalid dataLayerName', () => {
      expect(() => {
        render(<GtmScripts containers="GTM-ABC123" dataLayerName="test'Layer" />);
      }).toThrow('Invalid dataLayerName');
    });

    it('escapes single quotes in nonce', () => {
      const { container } = render(<GtmScripts containers="GTM-ABC123" scriptAttributes={{ nonce: "test'nonce" }} />);

      const script = container.querySelector('script');
      expect(script?.innerHTML).not.toContain("j.nonce='test'nonce'");
      expect(script?.innerHTML).toContain("j.nonce='test\\'nonce'");
    });

    it('escapes backslashes', () => {
      const { container } = render(<GtmScripts containers="GTM-ABC\\123" />);

      const script = container.querySelector('script');
      const content = script?.innerHTML || '';
      // Backslash should be escaped - content should NOT contain unescaped backslash
      expect(content).toContain('GTM-ABC');
      expect(content).toContain('123');
      // The escaped version should have more backslashes than the input
      expect(content.match(/GTM-ABC\\+123/)).toBeTruthy();
    });

    it('escapes newlines', () => {
      const { container } = render(<GtmScripts containers={'GTM-ABC\n123'} />);

      const script = container.querySelector('script');
      const content = script?.innerHTML || '';
      // Newline should be escaped - content should NOT contain literal newline in the string
      expect(content).toContain('GTM-ABC');
      expect(content).toContain('123');
      // Should contain escaped newline representation
      expect(content).toMatch(/GTM-ABC\\n123/);
    });
  });

  describe('container object format', () => {
    it('handles container descriptor with queryParams', () => {
      const { container } = render(
        <GtmScripts containers={{ id: 'GTM-ABC123', queryParams: { gtm_auth: 'abc', gtm_preview: 'env-1' } }} />
      );

      const script = container.querySelector('script');
      expect(script?.innerHTML).toContain('gtm_auth=abc');
      expect(script?.innerHTML).toContain('gtm_preview=env-1');
    });

    it('handles mixed container formats', () => {
      const { container } = render(
        <GtmScripts containers={['GTM-ABC123', { id: 'GTM-DEF456', queryParams: { gtm_auth: 'xyz' } }]} />
      );

      const script = container.querySelector('script');
      expect(script?.innerHTML).toContain('GTM-ABC123');
      expect(script?.innerHTML).toContain('GTM-DEF456');
      expect(script?.innerHTML).toContain('gtm_auth=xyz');
    });
  });

  describe('custom host', () => {
    it('uses custom host URL', () => {
      const { container } = render(<GtmScripts containers="GTM-ABC123" host="https://custom.gtm.example.com" />);

      const script = container.querySelector('script');
      expect(script?.innerHTML).toContain('custom.gtm.example.com');
    });

    it('normalizes host URL with trailing slash', () => {
      const { container } = render(<GtmScripts containers="GTM-ABC123" host="https://custom.gtm.example.com/" />);

      const script = container.querySelector('script');
      // Should not have double slashes
      expect(script?.innerHTML).not.toContain('example.com//gtm.js');
      expect(script?.innerHTML).toContain('example.com/gtm.js');
    });
  });
});
