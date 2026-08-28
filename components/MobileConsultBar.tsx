"use client";

import { useLanguage } from "./LanguageContext";

type MobileConsultBarProps = {
  onEnquire: () => void;
};

export function MobileConsultBar({
  onEnquire,
}: MobileConsultBarProps) {
  const { t } = useLanguage();

  return (
    <aside
      className="mobile-consult-bar"
      aria-label={t.mobileConsult.enquire}
    >
      <a
        className="button button-light"
        href="#planner"
      >
        {t.mobileConsult.planner}
      </a>

      <button
        type="button"
        className="button button-dark"
        onClick={onEnquire}
      >
        {t.mobileConsult.enquire}
      </button>
    </aside>
  );
}
