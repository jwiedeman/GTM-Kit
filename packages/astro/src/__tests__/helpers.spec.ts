import {
  normalizeContainer,
  normalizeContainers,
  buildScriptUrl,
  buildNoscriptUrl,
  generateScriptTags,
  generateNoscriptTags,
  generateDataLayerScript,
  generateGtmScript,
  isValidJsIdentifier,
  escapeJsString,
  DEFAULT_GTM_HOST
} from '../components/helpers';

describe('Component Helpers', () => {
  describe('normalizeContainer', () => {
    it('should normalize string to container descriptor', () => {
      expect(normalizeContainer('GTM-ABC123')).toEqual({ id: 'GTM-ABC123' });
    });

    it('should pass through container descriptor', () => {
      const descriptor = { id: 'GTM-ABC123', queryParams: { env: 'prod' } };
      expect(normalizeContainer(descriptor)).toEqual(descriptor);
    });
  });

  describe('normalizeContainers', () => {
    it('should normalize single string', () => {
      expect(normalizeContainers('GTM-ABC123')).toEqual([{ id: 'GTM-ABC123' }]);
    });

    it('should normalize array of strings', () => {
      expect(normalizeContainers(['GTM-ABC123', 'GTM-DEF456'])).toEqual([{ id: 'GTM-ABC123' }, { id: 'GTM-DEF456' }]);
    });

    it('should normalize mixed array', () => {
      expect(normalizeContainers(['GTM-ABC123', { id: 'GTM-DEF456', queryParams: { env: 'prod' } }])).toEqual([
        { id: 'GTM-ABC123' },
        { id: 'GTM-DEF456', queryParams: { env: 'prod' } }
      ]);
    });
  });

  describe('buildScriptUrl', () => {
    it('should build basic URL', () => {
      const url = buildScriptUrl(DEFAULT_GTM_HOST, 'GTM-ABC123');
      expect(url).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-ABC123');
    });

    it('should include query params', () => {
      const url = buildScriptUrl(DEFAULT_GTM_HOST, 'GTM-ABC123', { gtm_auth: 'abc', gtm_preview: 'env-1' });
      expect(url).toContain('gtm_auth=abc');
      expect(url).toContain('gtm_preview=env-1');
    });

    it('should include custom dataLayer name', () => {
      const url = buildScriptUrl(DEFAULT_GTM_HOST, 'GTM-ABC123', undefined, 'customDataLayer');
      expect(url).toContain('l=customDataLayer');
    });

    it('should normalize trailing slash in host', () => {
      const url = buildScriptUrl('https://example.com/', 'GTM-ABC123');
      expect(url).toBe('https://example.com/gtm.js?id=GTM-ABC123');
    });
  });

  describe('buildNoscriptUrl', () => {
    it('should build noscript URL', () => {
      const url = buildNoscriptUrl(DEFAULT_GTM_HOST, 'GTM-ABC123');
      expect(url).toBe('https://www.googletagmanager.com/ns.html?id=GTM-ABC123');
    });
  });

  describe('generateScriptTags', () => {
    it('should generate script tag data for single container', () => {
      const tags = generateScriptTags({ containers: 'GTM-ABC123' });

      expect(tags).toHaveLength(1);
      expect(tags[0]).toMatchObject({
        id: 'GTM-ABC123',
        src: 'https://www.googletagmanager.com/gtm.js?id=GTM-ABC123',
        async: true,
        defer: undefined,
        nonce: undefined,
        attributes: {}
      });
    });

    it('should include initScript with gtm.start event push', () => {
      const tags = generateScriptTags({ containers: 'GTM-ABC123' });

      expect(tags[0].initScript).toContain('window.dataLayer=window.dataLayer||[];');
      expect(tags[0].initScript).toContain("'gtm.start'");
      expect(tags[0].initScript).toContain("event:'gtm.js'");
    });

    it('should use custom dataLayer name in initScript', () => {
      const tags = generateScriptTags({ containers: 'GTM-ABC123', dataLayerName: 'myDL' });

      expect(tags[0].initScript).toContain('window.myDL=window.myDL||[];');
      expect(tags[0].initScript).toContain('window.myDL.push(');
    });

    it('should generate script tags for multiple containers', () => {
      const tags = generateScriptTags({ containers: ['GTM-ABC123', 'GTM-DEF456'] });

      expect(tags).toHaveLength(2);
      expect(tags[0].id).toBe('GTM-ABC123');
      expect(tags[1].id).toBe('GTM-DEF456');
      expect(tags[0].initScript).toBeDefined();
      expect(tags[1].initScript).toBeDefined();
    });

    it('should include script attributes', () => {
      const tags = generateScriptTags({
        containers: 'GTM-ABC123',
        scriptAttributes: {
          nonce: 'abc123',
          defer: true,
          'data-custom': 'value'
        }
      });

      expect(tags[0].nonce).toBe('abc123');
      expect(tags[0].defer).toBe(true);
      expect(tags[0].attributes).toEqual({ 'data-custom': 'value' });
    });

    it('should throw for empty containers', () => {
      expect(() => generateScriptTags({ containers: [] })).toThrow('At least one GTM container is required');
    });

    it('should throw for missing container id', () => {
      expect(() => generateScriptTags({ containers: { id: '' } })).toThrow('Container id is required');
    });

    it('should throw for invalid dataLayerName', () => {
      expect(() => generateScriptTags({ containers: 'GTM-ABC123', dataLayerName: "'; alert('XSS');" })).toThrow(
        'Invalid dataLayerName'
      );
    });
  });

  describe('generateGtmScript', () => {
    it('should generate the standard GTM snippet', () => {
      const script = generateGtmScript({ containers: 'GTM-ABC123' });

      expect(script).toContain("'gtm.start'");
      expect(script).toContain("event:'gtm.js'");
      expect(script).toContain('GTM-ABC123');
      expect(script).toContain('gtm.js?id=');
      expect(script).toContain('j.async=true');
      expect(script).toContain('insertBefore');
    });

    it('should use default dataLayer name', () => {
      const script = generateGtmScript({ containers: 'GTM-ABC123' });

      expect(script).toContain("'dataLayer'");
    });

    it('should use custom dataLayer name', () => {
      const script = generateGtmScript({ containers: 'GTM-ABC123', dataLayerName: 'myDL' });

      expect(script).toContain("'myDL'");
    });

    it('should use custom host', () => {
      const script = generateGtmScript({ containers: 'GTM-ABC123', host: 'https://gtm.example.com' });

      expect(script).toContain('gtm.example.com/gtm.js');
    });

    it('should handle multiple containers', () => {
      const script = generateGtmScript({ containers: ['GTM-ABC123', 'GTM-DEF456'] });

      expect(script).toContain('GTM-ABC123');
      expect(script).toContain('GTM-DEF456');
    });

    it('should throw for empty containers', () => {
      expect(() => generateGtmScript({ containers: [] })).toThrow('At least one GTM container is required');
    });

    it('should throw for missing container id', () => {
      expect(() => generateGtmScript({ containers: { id: '' } })).toThrow('Container id is required');
    });

    it('should throw for invalid dataLayerName (XSS prevention)', () => {
      expect(() => generateGtmScript({ containers: 'GTM-ABC123', dataLayerName: "'; alert('XSS');" })).toThrow(
        'Invalid dataLayerName'
      );
    });

    it('should escape container IDs for XSS prevention', () => {
      // Container IDs are escaped through escapeJsString
      const script = generateGtmScript({ containers: 'GTM-ABC123' });
      // Should not contain unescaped angle brackets
      expect(script).not.toContain('<');
      expect(script).not.toContain('>');
    });
  });

  describe('generateNoscriptTags', () => {
    it('should generate noscript tag data', () => {
      const tags = generateNoscriptTags({ containers: 'GTM-ABC123' });

      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual({
        id: 'GTM-ABC123',
        src: 'https://www.googletagmanager.com/ns.html?id=GTM-ABC123',
        attributes: {
          height: '0',
          width: '0',
          style: 'display:none;visibility:hidden',
          title: 'Google Tag Manager'
        }
      });
    });

    it('should merge custom iframe attributes', () => {
      const tags = generateNoscriptTags({
        containers: 'GTM-ABC123',
        iframeAttributes: { title: 'Custom Title', 'data-test': 'value' }
      });

      expect(tags[0].attributes.title).toBe('Custom Title');
      expect(tags[0].attributes['data-test']).toBe('value');
    });
  });

  describe('generateDataLayerScript', () => {
    it('should generate default dataLayer init', () => {
      const script = generateDataLayerScript();
      expect(script).toBe('window.dataLayer=window.dataLayer||[];');
    });

    it('should use custom dataLayer name', () => {
      const script = generateDataLayerScript('customDataLayer');
      expect(script).toBe('window.customDataLayer=window.customDataLayer||[];');
    });

    it('should throw for invalid dataLayerName (XSS prevention)', () => {
      expect(() => generateDataLayerScript("test'Layer")).toThrow('Invalid dataLayerName');
      expect(() => generateDataLayerScript('test-layer')).toThrow('Invalid dataLayerName');
      expect(() => generateDataLayerScript('1invalid')).toThrow('Invalid dataLayerName');
      expect(() => generateDataLayerScript("'; alert('XSS'); //")).toThrow('Invalid dataLayerName');
      expect(() => generateDataLayerScript('x]; alert(1); var y=[')).toThrow('Invalid dataLayerName');
    });

    it('should accept valid JavaScript identifiers', () => {
      expect(() => generateDataLayerScript('dataLayer')).not.toThrow();
      expect(() => generateDataLayerScript('myDataLayer')).not.toThrow();
      expect(() => generateDataLayerScript('_privateLayer')).not.toThrow();
      expect(() => generateDataLayerScript('$layer')).not.toThrow();
      expect(() => generateDataLayerScript('layer123')).not.toThrow();
    });
  });

  describe('isValidJsIdentifier', () => {
    it('should accept valid identifiers', () => {
      expect(isValidJsIdentifier('dataLayer')).toBe(true);
      expect(isValidJsIdentifier('myVar')).toBe(true);
      expect(isValidJsIdentifier('_private')).toBe(true);
      expect(isValidJsIdentifier('$dollar')).toBe(true);
      expect(isValidJsIdentifier('camelCase')).toBe(true);
      expect(isValidJsIdentifier('with123numbers')).toBe(true);
    });

    it('should reject invalid identifiers', () => {
      expect(isValidJsIdentifier('123invalid')).toBe(false);
      expect(isValidJsIdentifier('has-dash')).toBe(false);
      expect(isValidJsIdentifier('has space')).toBe(false);
      expect(isValidJsIdentifier("has'quote")).toBe(false);
      expect(isValidJsIdentifier('has.dot')).toBe(false);
      expect(isValidJsIdentifier('')).toBe(false);
    });

    it('should reject XSS attempts', () => {
      expect(isValidJsIdentifier("'; alert('XSS'); //")).toBe(false);
      expect(isValidJsIdentifier('x]; alert(1); var y=[')).toBe(false);
      expect(isValidJsIdentifier('<script>alert(1)</script>')).toBe(false);
    });
  });

  describe('escapeJsString', () => {
    it('should escape single quotes', () => {
      expect(escapeJsString("test'value")).toBe("test\\'value");
    });

    it('should escape double quotes', () => {
      expect(escapeJsString('test"value')).toBe('test\\"value');
    });

    it('should escape backslashes', () => {
      expect(escapeJsString('test\\value')).toBe('test\\\\value');
    });

    it('should escape newlines', () => {
      expect(escapeJsString('test\nvalue')).toBe('test\\nvalue');
      expect(escapeJsString('test\rvalue')).toBe('test\\rvalue');
    });

    it('should escape angle brackets', () => {
      expect(escapeJsString('<script>')).toBe('\\x3cscript\\x3e');
    });

    it('should escape Unicode line terminators', () => {
      expect(escapeJsString('test\u2028value')).toBe('test\\u2028value');
      expect(escapeJsString('test\u2029value')).toBe('test\\u2029value');
    });

    it('should handle XSS attempts', () => {
      const xssAttempt = "granted', }); alert('XSS'); //";
      const escaped = escapeJsString(xssAttempt);
      expect(escaped).not.toContain("'XSS'");
      expect(escaped).toContain("\\'XSS\\'");
    });
  });
});
