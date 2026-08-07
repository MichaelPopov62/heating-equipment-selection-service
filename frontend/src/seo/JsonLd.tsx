/**
 * Назначение: рендер JSON-LD у document через React (SPA-маршрути).
 */

import { useEffect } from 'react';

const JSON_LD_ATTR = 'data-heatcalc-jsonld';

type JsonLdProps = {
  /** Масив Schema.org об'єктів для серіалізації в окремі script-теги. */
  schemas: Record<string, unknown>[];
};

/**
 * @param props — schemas для поточного маршруту
 */
export function JsonLd({ schemas }: JsonLdProps) {
  useEffect(() => {
    document
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach((node) => {
        node.remove();
      });

    const created: HTMLScriptElement[] = [];
    for (const schema of schemas) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(JSON_LD_ATTR, 'true');
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
      created.push(script);
    }

    return () => {
      created.forEach((node) => {
        node.remove();
      });
    };
  }, [schemas]);

  return null;
}
