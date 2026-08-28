"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

type TravelPreferencesProps = {
  onConsult: (message: string) => void;
};

export function TravelPreferences({
  onConsult,
}: TravelPreferencesProps) {
  const { language, t } = useLanguage();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allItems = t.preferences.groups.flatMap(
    (group) =>
      group.items as readonly {
        id: string;
        label: string;
      }[],
  );

  function togglePreference(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function handleConsult() {
    const selectedLabels = allItems
      .filter((item) => selectedIds.includes(item.id))
      .map((item) => item.label);

    if (selectedLabels.length === 0) {
      onConsult(t.preferences.emptyMessage);
      return;
    }

    const separator = language === "zh" ? "、" : ", ";

    const prefix =
      language === "zh"
        ? "旅行偏好："
        : "Travel preferences: ";

    onConsult(
      `${prefix}${selectedLabels.join(separator)}`,
    );
  }

  return (
    <section
      id="preferences"
      className="section section-preferences"
      data-testid="travel-preferences"
    >
      <div className="container">
        <div className="section-row section-row-start">
          <SectionHeading
            eyebrow={t.preferences.eyebrow}
            title={t.preferences.title}
            description={t.preferences.description}
          />

          <span className="section-side-note">
            01 / 04
            <br />
            <span>
              {language === "zh"
                ? "从偏好开始"
                : "START HERE"}
            </span>
          </span>
        </div>

        <div className="preferences-grid">
          {t.preferences.groups.map((group) => (
            <div
              className="preference-group"
              key={group.title}
            >
              <h3>{group.title}</h3>

              <div className="preference-options">
                {group.items.map((item) => {
                  const selected =
                    selectedIds.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        "travel-preference-chip" +
                        (selected
                          ? " travel-preference-chip-selected"
                          : "")
                      }
                      aria-pressed={selected}
                      onClick={() =>
                        togglePreference(item.id)
                      }
                    >
                      <span>{item.label}</span>

                      <span aria-hidden="true">
                        {selected ? "✓" : "+"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="preferences-actions">
          <button
            type="button"
            className="button button-dark"
            data-testid="travel-preferences-consult"
            onClick={handleConsult}
          >
            {t.preferences.consult}
            <span aria-hidden="true">→</span>
          </button>

          <a
            className="button button-light"
            href="#planner"
          >
            {t.preferences.planner}
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
