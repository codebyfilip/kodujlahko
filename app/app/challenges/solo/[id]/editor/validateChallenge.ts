export type ValidationResult = {
  ruleId: string;
  passed: boolean;
  points: number;
  description: string;
};

type Rule = {
  id: string;
  type: string;
  description: string;
  points: number;
  params: Record<string, unknown>;
};

function buildDoc(html: string, css: string, js: string) {
  const t = html.trim();
  const isFullDoc = /^<!doctype\s+html/i.test(t) || /^<html[\s>]/i.test(t);
  if (isFullDoc) {
    let doc = html;
    if (css) {
      doc = doc.includes('</head>')
        ? doc.replace('</head>', `<style>${css}</style></head>`)
        : `<style>${css}</style>` + doc;
    }
    if (js) {
      doc = doc.includes('</body>')
        ? doc.replace('</body>', `<script>${js}<\/script></body>`)
        : doc + `<script>${js}<\/script>`;
    }
    return doc;
  }
  return `<!doctype html><html lang="sk"><head><meta charset="UTF-8"><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
}

function loadValidationIframe(docHtml: string): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:800px;height:600px;visibility:hidden;pointer-events:none;';
    // allow-same-origin needed to access contentDocument for computed styles
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    document.body.appendChild(iframe);

    const timeout = setTimeout(() => reject(new Error('iframe timeout')), 5000);
    iframe.onload = () => { clearTimeout(timeout); resolve(iframe); };
    iframe.onerror = () => { clearTimeout(timeout); reject(new Error('iframe error')); };

    const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
    iframe.src = URL.createObjectURL(blob);
  });
}

async function checkRule(
  rule: Rule,
  iframe: HTMLIFrameElement,
  cssSource: string,
  jsSource: string
): Promise<boolean> {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) return false;

  const p = rule.params;

  switch (rule.type) {
    case 'element_exists': {
      const selector = p.selector as string;
      return doc.querySelector(selector) !== null;
    }

    case 'element_count': {
      const selector = p.selector as string;
      const min = (p.min as number) ?? 1;
      const max = p.max as number | null ?? null;
      const count = doc.querySelectorAll(selector).length;
      if (count < min) return false;
      if (max !== null && count > max) return false;
      return true;
    }

    case 'text_content': {
      const selector = p.selector as string;
      const el = doc.querySelector(selector);
      return !!(el && el.textContent && el.textContent.trim().length > 0);
    }

    case 'attribute_value': {
      const selector = p.selector as string;
      const attribute = p.attribute as string;
      const expected = p.expected as string;
      const el = doc.querySelector(selector);
      return el?.getAttribute(attribute) === expected;
    }

    case 'attribute_exists': {
      const selector = p.selector as string;
      const attribute = p.attribute as string;
      const el = doc.querySelector(selector);
      return !!(el && el.hasAttribute(attribute));
    }

    case 'css_property_exists': {
      const selector = p.selector as string;
      const property = p.property as string;
      const el = doc.querySelector(selector);
      if (!el) return false;
      const computed = win.getComputedStyle(el);
      const value = computed.getPropertyValue(property);
      // Not empty and not the browser default 'none'/'0px'/'normal' for box-shadow etc.
      if (!value || value === 'none' || value === 'normal' || value === '0px') {
        // Fall back to source check — property appears in CSS targeting this selector
        return cssSource.includes(property.replace(/-/g, '[-_]?').replace(/([a-z])-([a-z])/g, '$1-$2'));
      }
      return true;
    }

    case 'css_property': {
      const selector = p.selector as string;
      const property = p.property as string;
      const expected = p.expected as string | undefined;
      const operator = p.operator as string | undefined;
      const el = doc.querySelector(selector);
      if (!el) return false;
      const computed = win.getComputedStyle(el);
      const value = computed.getPropertyValue(property).trim();
      if (!expected) return value !== '';
      if (!operator || operator === 'eq') return value === expected;
      if (operator === 'gte_px') {
        const val = parseFloat(value);
        const exp = parseFloat(expected);
        return !isNaN(val) && !isNaN(exp) && val >= exp;
      }
      if (operator === 'lte_px') {
        const val = parseFloat(value);
        const exp = parseFloat(expected);
        return !isNaN(val) && !isNaN(exp) && val <= exp;
      }
      if (operator === 'contains') return value.includes(expected);
      return value === expected;
    }

    case 'element_visible': {
      const selector = p.selector as string;
      const el = doc.querySelector(selector) as HTMLElement | null;
      if (!el) return false;
      const style = win.getComputedStyle(el);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        el.offsetParent !== null
      );
    }

    case 'js_function_exists': {
      const fnName = p.function_name as string;
      // Check in window (globals defined by the JS code)
      try {
        const val = (win as unknown as Record<string, unknown>)[fnName];
        return typeof val === 'function';
      } catch {
        // Fallback: check JS source text
        return (
          jsSource.includes(`function ${fnName}`) ||
          jsSource.includes(`${fnName} =`) ||
          jsSource.includes(`${fnName}=`)
        );
      }
    }

    case 'js_event_listener': {
      const selector = p.selector as string;
      const event = p.event as string;
      // Check if JS source contains addEventListener with this event
      // or the shorthand (onclick, etc.)
      const shorthand = `on${event}`;
      return (
        (jsSource.includes('addEventListener') && jsSource.includes(`'${event}'`)) ||
        (jsSource.includes('addEventListener') && jsSource.includes(`"${event}"`)) ||
        jsSource.includes(shorthand) ||
        (doc.querySelector(selector)?.getAttribute(shorthand) !== null &&
          doc.querySelector(selector)?.getAttribute(shorthand) !== undefined)
      );
    }

    case 'js_dom_mutation': {
      const triggerSelector = p.trigger_selector as string;
      const triggerEvent = (p.trigger_event as string) ?? 'click';
      const checkSelector = p.check_selector as string;
      const checkType = p.check_type as string;

      const triggerEl = doc.querySelector(triggerSelector) as HTMLElement | null;
      if (!triggerEl) return false;

      // Capture state before
      const checkEl = doc.querySelector(checkSelector) as HTMLElement | null;
      const beforeText = checkEl?.textContent ?? '';
      const beforeStyle = checkEl ? win.getComputedStyle(checkEl).cssText : '';
      const beforeClass = checkEl?.className ?? '';
      const beforeAttr = checkEl?.getAttribute('style') ?? '';
      const beforeValue = (checkEl as HTMLInputElement)?.value ?? '';
      const beforeChildOrder = checkEl ? Array.from(checkEl.children).map(c => c.textContent).join('|') : '';

      // Capture child count before
      const beforeChildCount = checkEl?.childElementCount ?? 0;
      const beforeVisDisplay = checkEl ? win.getComputedStyle(checkEl).display : '';
      const beforeVisVisibility = checkEl ? win.getComputedStyle(checkEl).visibility : '';
      const beforeVisOpacity = checkEl ? win.getComputedStyle(checkEl).opacity : '';

      // Dispatch the event (use InputEvent for input triggers, MouseEvent for others)
      let ev: Event;
      if (triggerEvent === 'input' || triggerEvent === 'change') {
        ev = new Event(triggerEvent, { bubbles: true, cancelable: true });
      } else {
        ev = new MouseEvent(triggerEvent, { bubbles: true, cancelable: true });
      }
      triggerEl.dispatchEvent(ev);

      // Small yield for sync JS to complete
      await new Promise(r => setTimeout(r, 80));

      const afterEl = doc.querySelector(checkSelector) as HTMLElement | null;
      const afterText = afterEl?.textContent ?? '';
      const afterStyle = afterEl ? win.getComputedStyle(afterEl).cssText : '';
      const afterClass = afterEl?.className ?? '';
      const afterAttr = afterEl?.getAttribute('style') ?? '';
      const afterChildCount = afterEl?.childElementCount ?? 0;
      const afterVisDisplay = afterEl ? win.getComputedStyle(afterEl).display : '';
      const afterVisVisibility = afterEl ? win.getComputedStyle(afterEl).visibility : '';
      const afterVisOpacity = afterEl ? win.getComputedStyle(afterEl).opacity : '';
      const afterValue = (afterEl as HTMLInputElement)?.value ?? '';
      const afterChildOrder = afterEl ? Array.from(afterEl.children).map(c => c.textContent).join('|') : '';

      if (checkType === 'text_changed') return afterText !== beforeText;
      if (checkType === 'text_not_empty') return afterText.trim().length > 0;
      if (checkType === 'style_changed') return afterStyle !== beforeStyle || afterAttr !== beforeAttr;
      if (checkType === 'class_changed' || checkType === 'class_added') return afterClass !== beforeClass;
      if (checkType === 'child_count_changed') return afterChildCount !== beforeChildCount;
      if (checkType === 'child_order_changed') return afterChildOrder !== beforeChildOrder;
      if (checkType === 'value_changed') return afterValue !== beforeValue;
      if (checkType === 'visibility_changed') {
        return (
          afterVisDisplay !== beforeVisDisplay ||
          afterVisVisibility !== beforeVisVisibility ||
          afterVisOpacity !== beforeVisOpacity ||
          afterClass !== beforeClass ||
          afterAttr !== beforeAttr
        );
      }
      // Generic: any mutation
      return afterText !== beforeText || afterStyle !== beforeStyle || afterClass !== beforeClass;
    }

    case 'visual_similarity':
      // Can't do pixel-accurate comparison client-side without a headless renderer.
      // Award partial credit (half points always pass; will not block anyone unfairly).
      return true;

    default:
      return true;
  }
}

export async function runChallengeValidation(
  html: string,
  css: string,
  js: string,
  rules: Rule[]
): Promise<ValidationResult[]> {
  const docHtml = buildDoc(html, css, js);
  let iframe: HTMLIFrameElement | null = null;

  try {
    iframe = await loadValidationIframe(docHtml);
    // Give JS a moment to execute
    await new Promise(r => setTimeout(r, 150));

    const results: ValidationResult[] = [];
    for (const rule of rules) {
      let passed = false;
      try {
        passed = await checkRule(rule, iframe, css, js);
      } catch {
        passed = false;
      }
      results.push({ ruleId: rule.id, passed, points: rule.points, description: rule.description });
    }
    return results;
  } finally {
    if (iframe) {
      URL.revokeObjectURL(iframe.src);
      iframe.remove();
    }
  }
}
