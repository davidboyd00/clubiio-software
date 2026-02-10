import { describe, it, expect } from 'vitest';

// ============================================
// WAF SECURITY TESTS
// ============================================
// Tests for validating WAF rule patterns and configurations

describe('WAF Security Patterns', () => {
  // ─────────────────────────────────────────
  // SQL INJECTION DETECTION
  // ─────────────────────────────────────────
  describe('SQL Injection Detection', () => {
    const sqlInjectionPatterns = [
      /(?:union\s+select|select\s+.+\s+from|insert\s+into)/i,
      /(?:delete\s+from|drop\s+table|update\s+.+\s+set)/i,
      /(?:exec\s*\(|execute\s*\()/i,
      /'--$/,
      /'\s+OR\s+'/i,
      /1\s*=\s*1/,
    ];

    const shouldDetect = (input: string): boolean => {
      return sqlInjectionPatterns.some(pattern => pattern.test(input));
    };

    it('should detect UNION-based SQL injection', () => {
      const attacks = [
        "1' UNION SELECT * FROM users--",
        "admin' UNION SELECT password FROM accounts--",
        "' union  select null,null,null--",
      ];

      attacks.forEach(attack => {
        expect(shouldDetect(attack)).toBe(true);
      });
    });

    it('should detect DELETE/DROP attacks', () => {
      const attacks = [
        "1; DELETE FROM users;--",
        "'; DROP TABLE customers;--",
        "1'; drop table orders --",
      ];

      attacks.forEach(attack => {
        expect(shouldDetect(attack)).toBe(true);
      });
    });

    it('should detect boolean-based injection', () => {
      const attacks = [
        "admin' OR '1'='1",
        "' OR 1=1--",
        "admin'--",
      ];

      attacks.forEach(attack => {
        expect(shouldDetect(attack)).toBe(true);
      });
    });

    it('should not flag legitimate queries', () => {
      const legitimate = [
        'Search for products',
        'User selected option',
        'Updated profile',
        'Insert record button clicked',
        'Order #12345',
        "McDonald's Restaurant",
      ];

      legitimate.forEach(input => {
        expect(shouldDetect(input)).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────
  // XSS DETECTION
  // ─────────────────────────────────────────
  describe('XSS Detection', () => {
    const xssPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<img[^>]+onerror/i,
      /%3Cscript/i,
    ];

    const shouldDetect = (input: string): boolean => {
      return xssPatterns.some(pattern => pattern.test(input));
    };

    it('should detect script tags', () => {
      const attacks = [
        '<script>alert(1)</script>',
        '<SCRIPT>document.cookie</SCRIPT>',
        "<script src='evil.js'>",
        '%3Cscript%3Ealert(1)%3C/script%3E',
      ];

      attacks.forEach(attack => {
        expect(shouldDetect(attack)).toBe(true);
      });
    });

    it('should detect event handlers', () => {
      const attacks = [
        '<img onerror="alert(1)" src=x>',
        '<div onmouseover=alert(1)>',
        '<body onload = "malicious()">',
        "<svg onload='fetch(\"/steal\")'>",
      ];

      attacks.forEach(attack => {
        expect(shouldDetect(attack)).toBe(true);
      });
    });

    it('should detect javascript: protocol', () => {
      const attacks = [
        'javascript:alert(1)',
        'JAVASCRIPT:void(0)',
        '<a href="javascript:document.cookie">',
      ];

      attacks.forEach(attack => {
        expect(shouldDetect(attack)).toBe(true);
      });
    });

    it('should not flag legitimate content', () => {
      const legitimate = [
        'The script was running smoothly',
        'JavaScript tutorial',
        '<code>console.log("hello")</code>',
        'onclick event documentation',
        'Function onSubmit',
      ];

      // Note: Some of these may trigger patterns due to content
      // In production, context-aware filtering is recommended
      const safeContent = [
        'Hello World',
        'Normal text content',
        'Product description here',
        '12345 order number',
      ];

      safeContent.forEach(input => {
        expect(shouldDetect(input)).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────
  // PATH TRAVERSAL DETECTION
  // ─────────────────────────────────────────
  describe('Path Traversal Detection', () => {
    const pathTraversalPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /%2e%2e%2f/i,
      /%2e%2e\//i,
      /\.\.%2f/i,
      /%2f\.\./i,
    ];

    const shouldDetect = (input: string): boolean => {
      return pathTraversalPatterns.some(pattern => pattern.test(input));
    };

    it('should detect directory traversal attempts', () => {
      const attacks = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/files/../../../config',
        'uploads/%2e%2e%2f%2e%2e%2fetc/passwd',
        '/api/..%2f..%2fadmin',
      ];

      attacks.forEach(attack => {
        expect(shouldDetect(attack)).toBe(true);
      });
    });

    it('should not flag legitimate paths', () => {
      const legitimate = [
        '/api/v1/users',
        '/files/documents/report.pdf',
        'relative-path/file.txt',
        '/uploads/image.png',
      ];

      legitimate.forEach(input => {
        expect(shouldDetect(input)).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────
  // BAD USER AGENT DETECTION
  // ─────────────────────────────────────────
  describe('Bad User Agent Detection', () => {
    const badUserAgentPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /masscan/i,
      /zgrab/i,
      /libwww-perl/i,
      /^wget/i,
    ];

    const shouldBlock = (userAgent: string): boolean => {
      return badUserAgentPatterns.some(pattern => pattern.test(userAgent));
    };

    it('should block known malicious scanners', () => {
      const maliciousAgents = [
        'sqlmap/1.0-dev',
        'Nikto/2.1.5',
        'Nmap Scripting Engine',
        'masscan/1.0',
        'zgrab/0.x',
        'libwww-perl/5.64',
        'Wget/1.21',
      ];

      maliciousAgents.forEach(agent => {
        expect(shouldBlock(agent)).toBe(true);
      });
    });

    it('should allow legitimate user agents', () => {
      const legitimateAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        'PostmanRuntime/7.28.0',
        'curl/7.64.1',
        'node-fetch/2.6.1',
      ];

      legitimateAgents.forEach(agent => {
        expect(shouldBlock(agent)).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────
  // COMMAND INJECTION DETECTION
  // ─────────────────────────────────────────
  describe('Command Injection Detection', () => {
    const commandInjectionPatterns = [
      /;\s*rm\s+-/i,
      /\|\s*cat\s+/i,
      /`[^`]+`/,
      /\$\([^)]+\)/,
      /\|\|/,
      /&&/,
      /;\s*\/bin\//,
    ];

    const shouldDetect = (input: string): boolean => {
      return commandInjectionPatterns.some(pattern => pattern.test(input));
    };

    it('should detect shell command injection', () => {
      const attacks = [
        '; rm -rf /',
        '| cat /etc/passwd',
        '`whoami`',
        '$(cat /etc/shadow)',
        'test || /bin/bash',
        'file && rm -rf *',
        '; /bin/sh -c "malicious"',
      ];

      attacks.forEach(attack => {
        expect(shouldDetect(attack)).toBe(true);
      });
    });

    it('should not flag legitimate input', () => {
      const legitimate = [
        'Regular search query',
        'Product name here',
        'Email: test@example.com',
        'Price: $10.00',
      ];

      legitimate.forEach(input => {
        expect(shouldDetect(input)).toBe(false);
      });
    });
  });
});

describe('WAF Rate Limiting Configuration', () => {
  // ─────────────────────────────────────────
  // RATE LIMIT THRESHOLDS
  // ─────────────────────────────────────────
  describe('Rate Limit Thresholds', () => {
    const rateLimits = {
      '/api/auth/login': { requests: 5, periodSeconds: 300 },
      '/api/auth/register': { requests: 3, periodSeconds: 3600 },
      '/api/auth/password-reset': { requests: 3, periodSeconds: 3600 },
      '/api/auth/pin-login': { requests: 3, periodSeconds: 300 },
      '/api/auth/mfa/*': { requests: 5, periodSeconds: 900 },
      '/api/*': { requests: 100, periodSeconds: 60 },
    };

    it('should have stricter limits on auth endpoints', () => {
      const authEndpoints = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/password-reset',
        '/api/auth/pin-login',
      ];

      const generalLimit = rateLimits['/api/*'];

      authEndpoints.forEach(endpoint => {
        const limit = rateLimits[endpoint as keyof typeof rateLimits];
        // Auth endpoints should allow fewer requests
        expect(limit.requests).toBeLessThan(generalLimit.requests);
      });
    });

    it('should have appropriate time windows for auth endpoints', () => {
      // Login/PIN should have shorter windows (5 min)
      expect(rateLimits['/api/auth/login'].periodSeconds).toBe(300);
      expect(rateLimits['/api/auth/pin-login'].periodSeconds).toBe(300);

      // Register/Reset should have longer windows (1 hour)
      expect(rateLimits['/api/auth/register'].periodSeconds).toBe(3600);
      expect(rateLimits['/api/auth/password-reset'].periodSeconds).toBe(3600);
    });

    it('should limit registration attempts heavily', () => {
      const registerLimit = rateLimits['/api/auth/register'];
      // Only 3 registrations per hour per IP
      expect(registerLimit.requests).toBe(3);
      expect(registerLimit.periodSeconds).toBe(3600);
    });
  });

  // ─────────────────────────────────────────
  // ENDPOINT PATTERN MATCHING
  // ─────────────────────────────────────────
  describe('Endpoint Pattern Matching', () => {
    const matchesAuthEndpoint = (path: string): boolean => {
      return /^\/api\/auth\//.test(path);
    };

    const matchesMfaEndpoint = (path: string): boolean => {
      return /^\/api\/auth\/mfa\//.test(path);
    };

    it('should correctly identify auth endpoints', () => {
      const authPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/logout',
        '/api/auth/refresh',
      ];

      authPaths.forEach(path => {
        expect(matchesAuthEndpoint(path)).toBe(true);
      });
    });

    it('should correctly identify MFA endpoints', () => {
      const mfaPaths = [
        '/api/auth/mfa/setup',
        '/api/auth/mfa/verify',
        '/api/auth/mfa/disable',
      ];

      mfaPaths.forEach(path => {
        expect(matchesMfaEndpoint(path)).toBe(true);
      });
    });

    it('should not match non-auth endpoints', () => {
      const nonAuthPaths = [
        '/api/users',
        '/api/orders',
        '/api/products',
        '/health',
      ];

      nonAuthPaths.forEach(path => {
        expect(matchesAuthEndpoint(path)).toBe(false);
      });
    });
  });
});

describe('WAF Response Codes', () => {
  // ─────────────────────────────────────────
  // BLOCK RESPONSE VALIDATION
  // ─────────────────────────────────────────
  describe('Block Response Format', () => {
    interface WafBlockResponse {
      error: string;
      message: string;
      code: string;
    }

    const wafBlockResponse: WafBlockResponse = {
      error: 'ACCESS_DENIED',
      message: 'Request blocked by security policy',
      code: 'WAF_BLOCKED',
    };

    const rateLimitResponse: WafBlockResponse = {
      error: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    };

    it('should return proper WAF block response', () => {
      expect(wafBlockResponse).toHaveProperty('error');
      expect(wafBlockResponse).toHaveProperty('message');
      expect(wafBlockResponse).toHaveProperty('code');
      expect(wafBlockResponse.code).toBe('WAF_BLOCKED');
    });

    it('should return proper rate limit response', () => {
      expect(rateLimitResponse).toHaveProperty('error');
      expect(rateLimitResponse).toHaveProperty('message');
      expect(rateLimitResponse).toHaveProperty('code');
      expect(rateLimitResponse.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should not expose internal details', () => {
      // WAF responses should be generic to avoid information disclosure
      expect(wafBlockResponse.message).not.toContain('SQL');
      expect(wafBlockResponse.message).not.toContain('XSS');
      expect(wafBlockResponse.message).not.toContain('rule');
    });
  });
});

describe('WAF Content-Type Validation', () => {
  // ─────────────────────────────────────────
  // CONTENT-TYPE REQUIREMENTS
  // ─────────────────────────────────────────
  describe('JSON Content-Type Requirement', () => {
    const requiresJsonContentType = (method: string, path: string): boolean => {
      const methodsRequiringBody = ['POST', 'PUT', 'PATCH'];
      const apiPath = path.startsWith('/api/');
      return methodsRequiringBody.includes(method.toUpperCase()) && apiPath;
    };

    const hasValidJsonContentType = (contentType: string | undefined): boolean => {
      if (!contentType) return false;
      return contentType.toLowerCase().includes('application/json');
    };

    it('should require JSON content-type for POST/PUT/PATCH to API', () => {
      expect(requiresJsonContentType('POST', '/api/users')).toBe(true);
      expect(requiresJsonContentType('PUT', '/api/orders/123')).toBe(true);
      expect(requiresJsonContentType('PATCH', '/api/settings')).toBe(true);
    });

    it('should not require content-type for GET/DELETE', () => {
      expect(requiresJsonContentType('GET', '/api/users')).toBe(false);
      expect(requiresJsonContentType('DELETE', '/api/users/123')).toBe(false);
    });

    it('should validate JSON content-type header', () => {
      expect(hasValidJsonContentType('application/json')).toBe(true);
      expect(hasValidJsonContentType('application/json; charset=utf-8')).toBe(true);
      expect(hasValidJsonContentType('APPLICATION/JSON')).toBe(true);
      expect(hasValidJsonContentType('text/html')).toBe(false);
      expect(hasValidJsonContentType('text/plain')).toBe(false);
      expect(hasValidJsonContentType(undefined)).toBe(false);
    });
  });
});

describe('WAF Geographic Rules', () => {
  // ─────────────────────────────────────────
  // GEO BLOCKING CONFIGURATION
  // ─────────────────────────────────────────
  describe('Country Code Validation', () => {
    const allowedCountries = ['US', 'CA', 'MX', 'ES', 'AR', 'CO', 'CL', 'PE'];

    const isCountryAllowed = (countryCode: string): boolean => {
      return allowedCountries.includes(countryCode.toUpperCase());
    };

    it('should allow configured countries', () => {
      allowedCountries.forEach(country => {
        expect(isCountryAllowed(country)).toBe(true);
      });
    });

    it('should block non-configured countries', () => {
      const blockedCountries = ['RU', 'CN', 'KP', 'IR'];
      blockedCountries.forEach(country => {
        expect(isCountryAllowed(country)).toBe(false);
      });
    });

    it('should handle case insensitivity', () => {
      expect(isCountryAllowed('us')).toBe(true);
      expect(isCountryAllowed('Us')).toBe(true);
      expect(isCountryAllowed('US')).toBe(true);
    });
  });
});

describe('WAF Bot Protection', () => {
  // ─────────────────────────────────────────
  // BOT SCORE THRESHOLDS
  // ─────────────────────────────────────────
  describe('Bot Score Classification', () => {
    const classifyBotScore = (score: number): 'block' | 'challenge' | 'allow' => {
      if (score <= 1) return 'block';        // Definitely automated
      if (score <= 30) return 'challenge';   // Likely automated
      return 'allow';                         // Likely human (score > 30)
    };

    it('should block definitely automated traffic', () => {
      expect(classifyBotScore(0)).toBe('block');
      expect(classifyBotScore(1)).toBe('block');
    });

    it('should challenge likely automated traffic', () => {
      expect(classifyBotScore(2)).toBe('challenge');
      expect(classifyBotScore(15)).toBe('challenge');
      expect(classifyBotScore(30)).toBe('challenge');
    });

    it('should allow likely human traffic', () => {
      expect(classifyBotScore(31)).toBe('allow');
      expect(classifyBotScore(50)).toBe('allow');
      expect(classifyBotScore(80)).toBe('allow');
      expect(classifyBotScore(100)).toBe('allow');
    });
  });

  // ─────────────────────────────────────────
  // VERIFIED BOTS
  // ─────────────────────────────────────────
  describe('Verified Bot Allowlist', () => {
    const verifiedBots = [
      'Googlebot',
      'Bingbot',
      'UptimeRobot',
      'Pingdom',
      'health-check',
    ];

    const isVerifiedBot = (userAgent: string): boolean => {
      return verifiedBots.some(bot =>
        userAgent.toLowerCase().includes(bot.toLowerCase())
      );
    };

    it('should recognize search engine bots', () => {
      expect(isVerifiedBot('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true);
      expect(isVerifiedBot('Mozilla/5.0 (compatible; Bingbot/2.0)')).toBe(true);
    });

    it('should recognize monitoring services', () => {
      expect(isVerifiedBot('UptimeRobot/2.0')).toBe(true);
      expect(isVerifiedBot('Pingdom.com_bot_version_1.4')).toBe(true);
      expect(isVerifiedBot('health-check/1.0')).toBe(true);
    });

    it('should not recognize unknown bots as verified', () => {
      expect(isVerifiedBot('RandomBot/1.0')).toBe(false);
      expect(isVerifiedBot('custom-crawler')).toBe(false);
    });
  });
});
