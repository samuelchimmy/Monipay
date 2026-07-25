import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n/config';
import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LanguageSelectorProps {
  variant?: 'full' | 'compact';
}

export function LanguageSelector({ variant = 'full' }: LanguageSelectorProps) {
  const { i18n } = useTranslation();

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  if (variant === 'compact') {
    return (
      <Select value={i18n.language} onValueChange={(v) => i18n.changeLanguage(v)}>
        <SelectTrigger aria-label="Select language" className="w-auto h-7 text-[10px] font-bold tracking-wide gap-1 border-none bg-transparent px-1.5 text-[hsl(var(--mp-muted))] hover:text-[hsl(var(--mp-ink))] transition-colors focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
          <Globe className="w-3.5 h-3.5 flex-shrink-0" />
          <SelectValue>{currentLang.code.toUpperCase()}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" className="min-w-[140px]">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code} className="text-xs">
              <span className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-foreground/30 w-4">{lang.code.toUpperCase()}</span>
                <span>{lang.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select value={i18n.language} onValueChange={(v) => i18n.changeLanguage(v)}>
      <SelectTrigger aria-label="Select language" className="w-full">
        <SelectValue>{currentLang.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
