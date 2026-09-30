import React from 'react';
import { lang, setLang, LANGS, Lang } from '../i18n/lang';

/**
 * THE LANGUAGE CHOICE. Switching saves the choice and reloads the page in it
 * (i18n/lang.ts); the game's own save is written on the way out, so nothing is
 * lost. On the title screen both names are shown and the current one is lit. In
 * the rail it is one small chip that offers the other language.
 *
 * The names are each written in their own language and are never translated.
 */
const LangSwitch: React.FC<{ variant: 'title' | 'chip' }> = ({ variant }) => {
  if (variant === 'chip') {
    const other: Lang = lang === 'es' ? 'en' : 'es';
    const label = other === 'es' ? 'Jugar en español' : 'Play in English';
    return (
      <button className="dev-chip lang-chip" type="button" lang={other} title={label} aria-label={label}
              onClick={() => setLang(other)}>
        {other.toUpperCase()}
      </button>
    );
  }
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANGS.map(l => (
        <button key={l.id} type="button" lang={l.id} aria-pressed={l.id === lang}
                className={l.id === lang ? 'on' : ''}
                // The title scene starts a run on any click; choosing a language must not.
                onClick={e => { e.stopPropagation(); if (l.id !== lang) setLang(l.id); }}>
          {l.label}
        </button>
      ))}
    </div>
  );
};

export default LangSwitch;
