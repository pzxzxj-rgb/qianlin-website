"use client";

import { useEffect, useMemo, useState } from "react";
import { generateItinerary } from "../lib/itinerary/generateItinerary";
import type { ItineraryPlan, ItineraryTravelers } from "../lib/itinerary/types";
import { useLanguage } from "./LanguageContext";
import { usePlannerOptions } from "./PlannerOptionsProvider";
import { SectionHeading } from "./SectionHeading";

export type ItineraryPlannerSubmission = {
  plan: ItineraryPlan;
  places: string;
  message: string;
};

type ItineraryPlannerProps = {
  tenantId: string;
  onSendToConsultant: (submission: ItineraryPlannerSubmission) => void;
};

export function ItineraryPlanner({ tenantId, onSendToConsultant }: ItineraryPlannerProps) {
  const { language, t } = useLanguage();
  const { status, cities, destinations, error, retry } = usePlannerOptions();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [days, setDays] = useState(4);
  const [travelers, setTravelers] = useState<ItineraryTravelers>("2");
  const [startCity, setStartCity] = useState("");
  const [endCity, setEndCity] = useState("");
  const [plan, setPlan] = useState<ItineraryPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [generating, setGenerating] = useState(false);

  const planningDestinations = useMemo(
    () => destinations.filter((destination) => destination.availableForPlanning),
    [destinations],
  );
  const startCities = useMemo(() => cities.filter((city) => city.availableAsStart), [cities]);
  const endCities = useMemo(() => cities.filter((city) => city.availableAsEnd), [cities]);
  const destinationKey = planningDestinations.map((destination) => destination.id).join("|");
  const startCityKey = startCities.map((city) => city.code).join("|");
  const endCityKey = endCities.map((city) => city.code).join("|");

  const defaultCityCode = useMemo(
    () => startCities.find((city) => city.code === "guiyang")?.code || startCities[0]?.code || "",
    [startCities],
  );
  const defaultEndCityCode = useMemo(
    () => endCities.find((city) => city.code === "guiyang")?.code || endCities[0]?.code || "",
    [endCities],
  );
  const selectedStartCity = startCities.some((city) => city.code === startCity) ? startCity : defaultCityCode;
  const selectedEndCity = endCities.some((city) => city.code === endCity) ? endCity : defaultEndCityCode;
  const validSelectedIds = selectedIds.filter((id) => planningDestinations.some((destination) => destination.id === id));
  const canPlan = status === "success" && planningDestinations.length > 0 && startCities.length > 0 && endCities.length > 0;

  useEffect(() => {
    if (status !== "success") return;
    const validDestinationIds = new Set(planningDestinations.map((destination) => destination.id));
    const validStartCodes = new Set(startCities.map((city) => city.code));
    const validEndCodes = new Set(endCities.map((city) => city.code));
    const refreshTimer = window.setTimeout(() => {
      setSelectedIds((current) => current.filter((id) => validDestinationIds.has(id)));
      setStartCity((current) => validStartCodes.has(current) ? current : defaultCityCode);
      setEndCity((current) => validEndCodes.has(current) ? current : defaultEndCityCode);
      setPlan(null);
      setErrorMessage("");
    }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [defaultCityCode, defaultEndCityCode, destinationKey, endCityKey, planningDestinations, startCityKey, startCities, endCities, status]);

  const clearPlanState = () => {
    setPlan(null);
    setErrorMessage("");
  };

  const toggleDestination = (destinationId: string) => {
    setSelectedIds((current) => current.includes(destinationId)
      ? current.filter((id) => id !== destinationId)
      : [...current, destinationId]);
    clearPlanState();
  };

  const clearSelection = () => {
    setSelectedIds([]);
    clearPlanState();
  };

  const handleGenerate = async () => {
    if (validSelectedIds.length === 0) {
      setErrorMessage(t.planner.selectAtLeast);
      return;
    }
    if (!selectedStartCity || !selectedEndCity) {
      setErrorMessage(t.planner.noCities);
      return;
    }

    setGenerating(true);
    setErrorMessage("");
    try {
      const result = await generateItinerary(
        {
          tenantId,
          destinationIds: validSelectedIds,
          days,
          travelers,
          startCity: selectedStartCity,
          endCity: selectedEndCity,
          language,
        },
        { cities, destinations: planningDestinations },
      );
      setPlan(result);
    } catch (generationError) {
      setPlan(null);
      setErrorMessage(generationError instanceof Error ? generationError.message : t.planner.generateError);
    } finally {
      setGenerating(false);
    }
  };

  const sendToConsultant = () => {
    if (!plan) return;
    const cityName = (code: string) => cities.find((city) => city.code === code)?.name[language] || code;
    const destinationName = new Map(planningDestinations.map((destination) => [destination.id, destination.name[language]]));
    const selectedPlaces = plan.input.destinationIds
      .map((id) => destinationName.get(id))
      .filter((name): name is string => Boolean(name));
    const places = selectedPlaces.join(language === "zh" ? "、" : ", ");
    const dayLines = plan.days.map((day) => {
      const stops = day.stops.map((stop) => stop.name[language]).join(language === "zh" ? "、" : ", ");
      return day.title[language] + ": " + (stops || t.planner.flexibleDay);
    });
    const message = [
      t.planner.summary.startCity + ": " + cityName(plan.input.startCity),
      t.planner.summary.endCity + ": " + cityName(plan.input.endCity),
      t.planner.summary.days + ": " + String(plan.input.days),
      t.planner.summary.travelers + ": " + plan.input.travelers,
      t.planner.summary.places + ": " + (places || t.planner.empty),
      t.planner.summary.itinerary + ":",
      ...dayLines,
      plan.warnings.length > 0 ? t.planner.warnings + ": " + plan.warnings.join(" ") : "",
    ].filter(Boolean).join("\n");
    onSendToConsultant({ plan, places, message });
  };

  const heading = <div className="section-row section-row-start"><SectionHeading eyebrow={t.planner.eyebrow} title={t.planner.title} description={t.planner.description} /><span className="section-side-note">01 / 03<br /><span>{t.planner.referenceLabel}</span></span></div>;

  if (status === "idle" || status === "loading") {
    return <section id="planner" className="section section-planner"><div className="container">{heading}<p className="planner-loading">{t.planner.loading}</p></div></section>;
  }

  if (status === "error") {
    return <section id="planner" className="section section-planner"><div className="container">{heading}<div className="planner-load-state"><p role="alert">{error}</p><button type="button" className="text-link" onClick={retry}>{t.planner.retry}</button></div></div></section>;
  }

  if (planningDestinations.length === 0) {
    return <section id="planner" className="section section-planner"><div className="container">{heading}<p className="planner-empty-state">{t.planner.noDestinations}</p></div></section>;
  }

  if (!startCities.length || !endCities.length) {
    return <section id="planner" className="section section-planner"><div className="container">{heading}<p className="planner-empty-state">{t.planner.noCities}</p></div></section>;
  }

  return (
    <section id="planner" className="section section-planner">
      <div className="container">
        {heading}
        <div className="planner-layout">
          <div className="planner-panel">
            <div className="planner-field-group">
              <div className="planner-field-heading"><span>{t.planner.fields.places}</span><small>{validSelectedIds.length}/{planningDestinations.length}</small></div>
              <div className="planner-place-grid">
                {planningDestinations.map((destination) => {
                  const selected = validSelectedIds.includes(destination.id);
                  const name = destination.name[language];
                  return <button type="button" className={"planner-place" + (selected ? " planner-place-selected" : "")} key={destination.id} onClick={() => toggleDestination(destination.id)} aria-pressed={selected}><span>{name}</span><span aria-hidden="true">{selected ? "✓" : "+"}</span></button>;
                })}
              </div>
            </div>
            <div className="planner-controls">
              <label>{t.planner.fields.days}<select value={days} onChange={(event) => { setDays(Number(event.target.value)); clearPlanState(); }} aria-label={t.planner.fields.days}>{t.planner.daysOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              <label>{t.planner.fields.travelers}<select value={travelers} onChange={(event) => { setTravelers(event.target.value as ItineraryTravelers); clearPlanState(); }} aria-label={t.planner.fields.travelers}>{t.planner.travelerOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              <label>{t.planner.fields.startCity}<select value={selectedStartCity} onChange={(event) => { setStartCity(event.target.value); clearPlanState(); }} aria-label={t.planner.fields.startCity}>{startCities.map((city) => <option value={city.code} key={city.id}>{city.name[language]}</option>)}</select></label>
              <label>{t.planner.fields.endCity}<select value={selectedEndCity} onChange={(event) => { setEndCity(event.target.value); clearPlanState(); }} aria-label={t.planner.fields.endCity}>{endCities.map((city) => <option value={city.code} key={city.id}>{city.name[language]}</option>)}</select></label>
            </div>
            {errorMessage ? <p className="planner-error" role="alert">{errorMessage}</p> : null}
            <div className="planner-actions"><button type="button" className="button button-dark" onClick={handleGenerate} disabled={generating || !canPlan}>{generating ? t.planner.generating : t.planner.generate} <span aria-hidden="true">→</span></button>{validSelectedIds.length > 0 ? <button type="button" className="text-link planner-clear" onClick={clearSelection}>{t.planner.clear}</button> : null}</div>
          </div>
          <div className="planner-intro-note"><span className="planner-note-mark" aria-hidden="true">✦</span><p>{t.planner.empty}</p><p>{t.planner.disclaimer}</p></div>
        </div>
        {plan ? <div className="planner-result"><div className="planner-result-heading"><div><span className="eyebrow">{t.planner.resultEyebrow}</span><h3>{t.planner.resultTitle}</h3></div><button type="button" className="button button-dark" onClick={sendToConsultant}>{t.planner.submit} <span aria-hidden="true">→</span></button></div><div className="itinerary-days">{plan.days.map((day) => <article className="itinerary-day" key={day.day}><div className="itinerary-day-top"><span>{String(day.day).padStart(2, "0")}</span><small>{day.region}</small></div><h4>{day.title[language]}</h4>{day.stops.length > 0 ? <ul>{day.stops.map((stop) => <li key={stop.destinationId}>{stop.name[language]}</li>)}</ul> : <p className="itinerary-empty-day">{t.planner.flexibleDay}</p>}{day.overnightSuggestion ? <p className="itinerary-overnight"><strong>{t.planner.overnight}:</strong>{day.overnightSuggestion[language]}</p> : null}{day.note ? <p className="itinerary-note">{day.note[language]}</p> : null}</article>)}</div><div className="planner-result-footer"><div><strong>{t.planner.warnings}</strong>{plan.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>{plan.unassignedDestinationIds.length > 0 ? <div><strong>{t.planner.unassigned}</strong><p>{t.planner.unassignedCopy}</p></div> : null}</div><p className="planner-submit-note">{t.planner.submitNote}</p></div> : null}
      </div>
    </section>
  );
}
