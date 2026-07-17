import { DONATE_URL, SRD_LICENSE_URL, SRD_URL } from '../data/site'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer-sources">
        This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by
        Wizards of the Coast LLC and available at{' '}
        <a href={SRD_URL} target="_blank" rel="noreferrer">
          {SRD_URL}
        </a>
        . The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License
        available at{' '}
        <a href={SRD_LICENSE_URL} target="_blank" rel="noreferrer">
          {SRD_LICENSE_URL}
        </a>
        .
      </p>
      <p className="site-footer-sources">
        Имена авантюристов, гильдейские наборы и симуляция Великого Похода — оригинальный контент{' '}
        <span className="brand-mark">dndrun</span>.
      </p>
      <p className="site-footer-donate">
        Нравится забег?{' '}
        <a href={DONATE_URL} target="_blank" rel="noreferrer">
          Поддержать dndrun
        </a>
      </p>
      <p className="site-footer-legal">
        dndrun не связан с Wizards of the Coast LLC. Dungeons &amp; Dragons и Wizards of the Coast —
        товарные знаки Wizards of the Coast LLC.
      </p>
    </footer>
  )
}
