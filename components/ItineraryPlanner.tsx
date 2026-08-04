"use client";

import { useState } from "react";
import { destinations } from "../data/destinations";
import { generateItinerary } from "../lib/itinerary/generateItinerary";
import type { ItineraryPlan, ItineraryTravelers } from "../lib/itinerary/types";
import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

type ItineraryPlannerProps = {
  tenantId: string;
  onSendToConsultant: (plan: ItineraryPlan) => void;
};

export function ItineraryPlanner({ tenantId, onSendToConsultant }: ItineraryPlannerProps) {
  const { language, t } = useLanguage();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [days, setDays] = useState(4);
  const [travelers, setTravelers] = useState<ItineraryTravelers>("2");
  const [startCity, setStartCity] = useState("Guiyang");
  const [endCity, setEndCity] = useState("Guiyang");
  const [plan, setPlan] = useState<ItineraryPlan | null>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const toggleDestination = (destinationId: string) => {
    setSelectedIds((current) => current.includes(destinationId) ? current.filter((id) => id !== destinationId) : [...current, destinationId]);
    setPlan(null);
    setError("");
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setPlan(null);
    setError("");
  };

  const handleGenerate = async () => {
    if (selectedIds.length === 0) {
      setError(t.planner.selectAtLeast);
      return;
    }

    setGenerating(true);
    setError("");
    try {
      const result = await generateItinerary({ tenantId, destinationIds: selectedIds, days, travelers, startCity, endCity, language });
      setPlan(result);
    } catch (generationError) {
      setPlan(null);
      setError(generationError instanceof Error ? generationError.message : t.planner.generateError);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section id="planner" className="section section-planner">
      <div className="container">
        <div className="section-row section-row-start"><SectionHeading eyebrow={t.planner.eyebrow} title={t.planner.title} description={t.planner.description} /><span className="section-side-note">01 — 03<br /><span>{t.planner.referenceLabel}</span></span></div>
        <div className="planner-layout">
          <div className="planner-panel">
            <div className="planner-field-group"><div className="planner-field-heading"><span>{t.planner.fields.places}</span><small>{selectedIds.length}/{destinations.length}</small></div><div className="planner-place-grid">{destinations.map((destination) => { const selected = selectedIds.includes(destination.id); const name = language === "zh" ? destination.nameZh : destination.name; return <button type="button" className={`planner-place${selected ? " planner-place-selected" : ""}`} key={destination.id} onClick={() => toggleDestination(destination.id)} aria-pressed={selected}><span>{name}</span><span aria-hidden="true">{selected ? "✓" : "+"}</span></button>; })}</div></div>
            <div className="planner-controls">
              <label>{t.planner.fields.days}<select value={days} onChange={(event) => { setDays(Number(event.target.value)); setPlan(null); }} aria-label={t.planner.fields.days}>{t.planner.daysOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              <label>{t.planner.fields.travelers}<select value={travelers} onChange={(event) => { setTravelers(event.target.value as ItineraryTravelers); setPlan(null); }} aria-label={t.planner.fields.travelers}>{t.planner.travelerOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              <label>{t.planner.fields.startCity}<select value={startCity} onChange={(event) => { setStartCity(event.target.value); setPlan(null); }} aria-label={t.planner.fields.startCity}>{t.planner.cities.map((city) => <option value={city.value} key={city.value}>{city.label}</option>)}</select></label>
              <label>{t.planner.fields.endCity}<select value={endCity} onChange={(event) => { setEndCity(event.target.value); setPlan(null); }} aria-label={t.planner.fields.endCity}>{t.planner.cities.map((city) => <option value={city.value} key={city.value}>{city.label}</option>)}</select></label>
            </div>
            {error ? <p className="planner-error" role="alert">{error}</p> : null}
            <div className="planner-actions"><button type="button" className="button button-dark" onClick={handleGenerate} disabled={generating}>{generating ? t.planner.generating : t.planner.generate} <span aria-hidden="true">→</span></button>{selectedIds.length > 0 ? <button type="button" className="text-link planner-clear" onClick={clearSelection}>{t.planner.clear}</button> : null}</div>
          </div>
          <div className="planner-intro-note"><span className="planner-note-mark" aria-hidden="true">◎</span><p>{t.planner.empty}</p><p>{t.planner.disclaimer}</p></div>
        </div>
        {plan ? <div className="planner-result"><div className="planner-result-heading"><div><span className="eyebrow">{t.planner.resultEyebrow}</span><h3>{t.planner.resultTitle}</h3></div><button type="button" className="button button-dark" onClick={() => onSendToConsultant(plan)}>{t.planner.submit} <span aria-hidden="true">→</span></button></div><div className="itinerary-days">{plan.days.map((day) => <article className="itinerary-day" key={day.day}><div className="itinerary-day-top"><span>0{day.day}</span><small>{day.region}</small></div><h4>{day.title[language]}</h4>{day.stops.length > 0 ? <ul>{day.stops.map((stop) => <li key={stop.destinationId}>{stop.name[language]}</li>)}</ul> : <p className="itinerary-empty-day">{t.planner.flexibleDay}</p>}{day.overnightSuggestion ? <p className="itinerary-overnight"><strong>{t.planner.overnight}：</strong>{day.overnightSuggestion[language]}</p> : null}{day.note ? <p className="itinerary-note">{day.note[language]}</p> : null}</article>)}</div><div className="planner-result-footer"><div><strong>{t.planner.warnings}</strong>{plan.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>{plan.unassignedDestinationIds.length > 0 ? <div><strong>{t.planner.unassigned}</strong><p>{t.planner.unassignedCopy}</p></div> : null}</div><p className="planner-submit-note">{t.planner.submitNote}</p></div> : null}
      </div>
    </section>
  );
}
